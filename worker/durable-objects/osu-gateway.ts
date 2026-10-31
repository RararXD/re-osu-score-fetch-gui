import { DurableObject } from "cloudflare:workers";
import type { ScoreQuery } from "../../shared/contracts";
import { scoreQuerySchema } from "../../shared/contracts";
import type { Env } from "../env";
import {
  NOT_FOUND_CACHE_TTL_SECONDS,
  notFoundCacheKey,
  readScoreCache,
  sliceScores,
  writeScoreCache,
} from "../services/cache";
import {
  CredentialPool,
  type CredentialPoolSnapshot,
  credentialSignature,
  parseCredentials,
} from "../services/credential-pool";
import { ApiError, errorResponse, isApiError } from "../services/errors";
import {
  type AccessToken,
  fetchAccessToken,
  fetchBestScores,
  UpstreamResponseError,
} from "../services/osu-api";
import { RequestBudget, type RequestBudgetSnapshot } from "../services/request-budget";

const POOL_STORAGE_KEY = "oauth-pool-v1";
const BUDGET_STORAGE_KEY = "upstream-budget-v1";
const MAX_PENDING_QUERIES = 8;
const MAX_QUEUE_WAIT_MS = 10_000;

export class OsuGateway extends DurableObject<Env> {
  private tail: Promise<void> = Promise.resolve();
  private pending = 0;
  private readonly tokens = new Map<number, AccessToken>();

  override async fetch(request: Request): Promise<Response> {
    if (this.pending >= MAX_PENDING_QUERIES) {
      return errorResponse(new ApiError(503, "UPSTREAM_BUSY", "查询队列已满，请稍后重试。", 5));
    }
    this.pending += 1;
    const queuedAt = Date.now();
    const previous = this.tail;
    let release: () => void = () => undefined;
    this.tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      if (Date.now() - queuedAt >= MAX_QUEUE_WAIT_MS) {
        return errorResponse(new ApiError(503, "UPSTREAM_BUSY", "查询等待超时，请稍后重试。", 5));
      }
      return await this.handle(request);
    } finally {
      this.pending -= 1;
      release();
    }
  }

  private async handle(request: Request): Promise<Response> {
    if (request.method !== "POST" || new URL(request.url).pathname !== "/query") {
      return new Response("Not found", { status: 404 });
    }

    try {
      const query = scoreQuerySchema.parse(await request.json());
      const cached = await this.readCacheSafely(query);
      if (cached) return this.success(cached.data, "HIT", cached.ttl);
      const missing = await this.readMissingSafely(query.player);
      if (missing) {
        throw new ApiError(404, "PLAYER_NOT_FOUND", "未找到该玩家，请检查用户名或 ID。");
      }

      const credentials = parseCredentials(this.env.OSU_OAUTH_CREDENTIALS);
      if (credentials.length === 0) {
        throw new ApiError(503, "NOT_CONFIGURED", "服务端尚未配置 osu! OAuth 凭据。");
      }
      const signature = credentialSignature(credentials);
      const snapshot = await this.ctx.storage.get<CredentialPoolSnapshot>(POOL_STORAGE_KEY);
      const configuredLimit = Number(this.env.OSU_REQUESTS_PER_MINUTE ?? "30");
      const requestsPerMinute = Number.isFinite(configuredLimit)
        ? Math.max(3, Math.min(30, Math.trunc(configuredLimit)))
        : 30;
      const pool = new CredentialPool(credentials.length, requestsPerMinute, snapshot, signature);
      const budget = new RequestBudget(
        requestsPerMinute,
        await this.ctx.storage.get<RequestBudgetSnapshot>(BUDGET_STORAGE_KEY),
      );
      if (snapshot?.signature !== signature) this.tokens.clear();

      let shortestRetry = Number.POSITIVE_INFINITY;
      for (let attempt = 0; attempt < credentials.length; attempt += 1) {
        const now = Date.now();
        this.checkBudget(budget, 1, now);
        const reservation = pool.reserve((slot) => {
          const token = this.tokens.get(slot);
          return token && token.expiresAt > now ? 2 : 3;
        }, now);
        if (!reservation.ok) {
          shortestRetry = Math.min(shortestRetry, reservation.retryAfter);
          break;
        }

        const slot = reservation.slot;
        const token = this.tokens.get(slot);
        this.checkBudget(budget, token && token.expiresAt > now ? 2 : 3, now);
        await this.persistPool(pool, signature);
        try {
          const data = await this.queryWithSlot(query, credentials[slot], slot, budget);
          try {
            await writeScoreCache(this.env.SCORE_CACHE, query, data);
          } catch (error) {
            console.warn(
              JSON.stringify({ event: "score_cache_write_failed", error: safeName(error) }),
            );
          }
          return this.success(sliceScores(data, query.limit), "MISS", 180);
        } catch (error) {
          if (error instanceof UpstreamResponseError) {
            if (error.status === 404 && error.phase === "player") {
              try {
                await this.env.SCORE_CACHE.put(notFoundCacheKey(query.player), "1", {
                  expirationTtl: NOT_FOUND_CACHE_TTL_SECONDS,
                });
              } catch (cacheError) {
                console.warn(
                  JSON.stringify({
                    event: "negative_cache_write_failed",
                    error: safeName(cacheError),
                  }),
                );
              }
              throw new ApiError(404, "PLAYER_NOT_FOUND", "未找到该玩家，请检查用户名或 ID。");
            }
            if (error.status === 429) {
              const retryAfter = error.retryAfter ?? 60;
              pool.markCooldown(slot, Date.now() + retryAfter * 1000);
              budget.coolDown(Date.now() + retryAfter * 1000);
              await this.ctx.storage.put(BUDGET_STORAGE_KEY, budget.snapshot());
              await this.persistPool(pool, signature);
              throw new ApiError(
                503,
                "UPSTREAM_BUSY",
                "osu! API 正在冷却，请稍后重试。",
                retryAfter,
              );
            }
            if (error.phase === "oauth" && (error.status === 400 || error.status === 401)) {
              this.tokens.delete(slot);
              pool.markAuthenticationFailure(slot, Date.now());
              shortestRetry = Math.min(shortestRetry, 300);
              await this.persistPool(pool, signature);
              continue;
            }
            if (error.status === 401) {
              this.tokens.delete(slot);
              pool.markCooldown(slot, Date.now() + 5_000);
              shortestRetry = Math.min(shortestRetry, 5);
              await this.persistPool(pool, signature);
              continue;
            }
          }
          throw error;
        }
      }

      throw new ApiError(
        503,
        "UPSTREAM_BUSY",
        "所有 osu! API 凭据当前都在等待请求额度，请稍后重试。",
        Number.isFinite(shortestRetry) ? shortestRetry : 60,
      );
    } catch (error) {
      if (isApiError(error)) return errorResponse(error);
      console.error(JSON.stringify({ event: "osu_gateway_failed", error: safeName(error) }));
      return errorResponse(
        new ApiError(502, "UPSTREAM_ERROR", "osu! 服务暂时无法访问，请稍后重试。"),
      );
    }
  }

  private async queryWithSlot(
    query: ScoreQuery,
    credential: { clientId: string; clientSecret: string },
    slot: number,
    budget: RequestBudget,
  ) {
    const budgetedFetch: typeof fetch = async (input, init) => {
      const now = Date.now();
      this.checkBudget(budget, 1, now);
      budget.record(now);
      // Persist before sending: failures and restarts must not refund actual requests.
      await this.ctx.storage.put(BUDGET_STORAGE_KEY, budget.snapshot());
      return fetch(input, init);
    };
    let token = this.tokens.get(slot);
    if (!token || token.expiresAt <= Date.now()) {
      token = await fetchAccessToken(credential, budgetedFetch);
      this.tokens.set(slot, token);
    }
    return fetchBestScores(query.player, query.mode, token.value, budgetedFetch);
  }

  private checkBudget(budget: RequestBudget, required: number, now: number): void {
    const retryAfter = budget.retryAfter(required, now);
    if (retryAfter > 0) {
      throw new ApiError(
        503,
        "UPSTREAM_BUSY",
        "osu! API 请求额度暂时用尽，请稍后重试。",
        retryAfter,
      );
    }
  }

  private async persistPool(pool: CredentialPool, signature: string): Promise<void> {
    await this.ctx.storage.put(POOL_STORAGE_KEY, pool.snapshot(signature));
  }

  private async readCacheSafely(query: ScoreQuery) {
    try {
      return await readScoreCache(this.env.SCORE_CACHE, query);
    } catch (error) {
      console.warn(JSON.stringify({ event: "score_cache_read_failed", error: safeName(error) }));
      return null;
    }
  }

  private async readMissingSafely(player: string): Promise<string | null> {
    try {
      return await this.env.SCORE_CACHE.get(notFoundCacheKey(player));
    } catch (error) {
      console.warn(JSON.stringify({ event: "negative_cache_read_failed", error: safeName(error) }));
      return null;
    }
  }

  private success(data: unknown, cache: "HIT" | "MISS", ttl: number): Response {
    return Response.json(data, {
      headers: {
        "Cache-Control": "no-store",
        "X-Cache": cache,
        "X-Cache-TTL": String(ttl),
      },
    });
  }
}

function safeName(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownError";
}
