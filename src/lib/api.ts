import type { ErrorResponse, QueryMode, ScoresResponse } from "../../shared/contracts";

export interface ScoreResult {
  data: ScoresResponse;
  cache: string;
  refreshAt: number | null;
}

export class ApiError extends Error {
  readonly retryAt: number;

  constructor(
    public readonly code: string,
    public readonly status: number,
    public readonly retryAfter: number,
  ) {
    super(code);
    this.retryAt = Date.now() + retryAfter * 1000;
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
    const retryAfter = parseRetryAfter(response.headers.get("Retry-After"));
    throw new ApiError(body?.error?.code ?? "UNKNOWN_ERROR", response.status, retryAfter);
  }
  const ttlHeader = response.headers.get("X-Cache-TTL");
  const ttl = ttlHeader === null ? Number.NaN : Number(ttlHeader);
  return {
    data: (await response.json()) as ScoresResponse,
    cache: response.headers.get("X-Cache") ?? "UNKNOWN",
    refreshAt: Number.isFinite(ttl) && ttl >= 0 ? Date.now() + ttl * 1000 : null,
  };
}

export function parseRetryAfter(value: string | null, now = Date.now()): number {
  if (value === null || value.trim() === "") return 5;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, Math.ceil((date - now) / 1000)) : 5;
}
