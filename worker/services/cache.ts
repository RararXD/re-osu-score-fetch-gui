import type { ScoreCacheEntry, ScoreQuery, ScoresResponse } from "../../shared/contracts";
import { normalizePlayer } from "../../shared/player";

export { normalizePlayer } from "../../shared/player";

export const SCORE_CACHE_TTL_SECONDS = 180;
export const NOT_FOUND_CACHE_TTL_SECONDS = 60;

export function scoreCacheKey(query: Pick<ScoreQuery, "player" | "mode">): string {
  return `scores:v1:${query.mode}:${normalizePlayer(query.player)}`;
}

export function notFoundCacheKey(player: string): string {
  return `missing:v1:${normalizePlayer(player)}`;
}

export function sliceScores(data: ScoresResponse, limit: number): ScoresResponse {
  return data.scores.length <= limit ? data : { ...data, scores: data.scores.slice(0, limit) };
}

export async function readScoreCache(
  cache: KVNamespace,
  query: Pick<ScoreQuery, "player" | "mode" | "limit">,
  now = Date.now(),
): Promise<{ data: ScoresResponse; ttl: number } | null> {
  const entry = await cache.get<ScoreCacheEntry>(scoreCacheKey(query), "json");
  if (!entry?.data || !Number.isFinite(entry.expiresAt) || entry.expiresAt <= now) {
    return null;
  }
  return {
    data: sliceScores(entry.data, query.limit),
    ttl: Math.max(0, Math.ceil((entry.expiresAt - now) / 1000)),
  };
}

export async function writeScoreCache(
  cache: KVNamespace,
  query: Pick<ScoreQuery, "player" | "mode">,
  data: ScoresResponse,
  now = Date.now(),
): Promise<void> {
  const entry: ScoreCacheEntry = {
    data,
    expiresAt: now + SCORE_CACHE_TTL_SECONDS * 1000,
  };
  await cache.put(scoreCacheKey(query), JSON.stringify(entry), {
    expirationTtl: SCORE_CACHE_TTL_SECONDS,
  });
}
