import type { ErrorResponse, QueryMode, ScoresResponse } from "../../shared/contracts";

export interface ScoreResult {
  data: ScoresResponse;
  cache: string;
  refreshAt: number | null;
}

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    public readonly retryAfter: number,
  ) {
    super(code);
  }
}

export async function fetchScores(
  player: string,
  mode: QueryMode,
  limit: 20 | 50,
  signal: AbortSignal,
): Promise<ScoreResult> {
  const params = new URLSearchParams({ player, mode, limit: String(limit) });
  const response = await fetch(`/api/v1/scores?${params}`, { signal });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ErrorResponse | null;
    const retryAfter = Number(response.headers.get("Retry-After"));
    throw new ApiError(
      body?.error.code ?? "UNKNOWN_ERROR",
      response.status,
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 5,
    );
  }
  const ttl = Number(response.headers.get("X-Cache-TTL"));
  return {
    data: (await response.json()) as ScoresResponse,
    cache: response.headers.get("X-Cache") ?? "UNKNOWN",
    refreshAt: Number.isFinite(ttl) && ttl >= 0 ? Date.now() + ttl * 1000 : null,
  };
}
