import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { scoreQuerySchema } from "../shared/contracts";
import type { Env } from "./env";
import { assetRoutes } from "./routes/assets";
import { normalizePlayer, notFoundCacheKey, readScoreCache } from "./services/cache";
import { ApiError, errorResponse, isApiError } from "./services/errors";

export const app = new Hono<{ Bindings: Env }>();

app.use("*", async (c, next) => {
  const requestId = crypto.randomUUID();
  const started = performance.now();
  try {
    await next();
  } finally {
    c.header("X-Request-ID", requestId);
    if (c.req.path !== "/health" || c.res.status >= 400) {
      console.log(
        JSON.stringify({
          event: "request_completed",
          requestId,
          method: c.req.method,
          path: c.req.routePath || "unmatched",
          status: c.res.status,
          durationMs: Math.round((performance.now() - started) * 10) / 10,
          cache: c.res.headers.get("X-Cache") ?? undefined,
        }),
      );
    }
  }
});

app.get("/health", (c) =>
  c.json({ status: "ok", modes: ["osu", "taiko", "fruits", "mania"] as const }),
);

app.get(
  "/api/v1/scores",
  zValidator("query", scoreQuerySchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          error: {
            code: "INVALID_REQUEST" as const,
            message: "请检查玩家名称、模式和 Best 数量。",
          },
        },
        422,
      );
    }
  }),
  async (c) => {
    const query = c.req.valid("query");
    const ip = c.req.header("CF-Connecting-IP") ?? "local-development";
    const playerKey = normalizePlayer(query.player);
    const [ipLimit, playerLimit] = await Promise.all([
      c.env.IP_RATE_LIMITER.limit({ key: ip }),
      c.env.PLAYER_RATE_LIMITER.limit({ key: playerKey }),
    ]);
    if (!ipLimit.success || !playerLimit.success) {
      throw new ApiError(429, "RATE_LIMITED", "查询过于频繁，请稍后重试。", 60);
    }

    try {
      const cached = await readScoreCache(c.env.SCORE_CACHE, query);
      if (cached) {
        return c.json(cached.data, 200, {
          "Cache-Control": "no-store",
          "X-Cache": "HIT",
          "X-Cache-TTL": String(cached.ttl),
        });
      }
      const missing = await c.env.SCORE_CACHE.get(notFoundCacheKey(query.player));
      if (missing) {
        throw new ApiError(404, "PLAYER_NOT_FOUND", "未找到该玩家，请检查用户名或 ID。");
      }
    } catch (error) {
      if (isApiError(error)) throw error;
      console.warn(
        JSON.stringify({
          event: "score_cache_read_failed",
          error: error instanceof Error ? error.name : "UnknownError",
        }),
      );
    }

    const gateway = c.env.OSU_GATEWAY.get(c.env.OSU_GATEWAY.idFromName("global"));
    const upstream = await gateway.fetch("https://osu-gateway.internal/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(query),
    });
    const headers = new Headers(upstream.headers);
    headers.set("Cache-Control", "no-store");
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    });
  },
);

app.route("/api/v1/assets", assetRoutes);

app.notFound((c) =>
  c.json({ error: { code: "INVALID_REQUEST" as const, message: "接口不存在。" } }, 404),
);

app.onError((error, c) => {
  if (isApiError(error)) return errorResponse(error);
  console.error(
    JSON.stringify({
      event: "request_failed",
      error: error instanceof Error ? error.name : "UnknownError",
    }),
  );
  return c.json({ error: { code: "INTERNAL_ERROR" as const, message: "服务暂时不可用。" } }, 500, {
    "Cache-Control": "no-store",
  });
});

export type AppType = typeof app;
