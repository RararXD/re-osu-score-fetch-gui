import { z } from "zod";
import type { Ruleset, ScoresResponse } from "../../shared/contracts";
import type { OAuthCredential } from "./credential-pool";

const statisticsSchema = z
  .object({
    pp: z.number().nullable().optional(),
    global_rank: z.number().int().nullable().optional(),
    hit_accuracy: z.number().nullable().optional(),
    play_time: z.number().int().nonnegative().nullable().optional(),
  })
  .nullable()
  .optional();

const userSchema = z.object({
  id: z.number().int().positive(),
  username: z.string(),
  country_code: z.string(),
  playmode: z.enum(["osu", "taiko", "fruits", "mania"]),
  statistics: statisticsSchema,
});

const modSchema = z.union([z.string(), z.object({ acronym: z.string() })]);
const scoreSchema = z.object({
  id: z.number().int().nullable().optional(),
  accuracy: z.number(),
  pp: z.number().nullable().optional(),
  rank: z.string(),
  mods: z.array(modSchema).default([]),
  max_combo: z.number().int().nonnegative(),
  ended_at: z.string().nullable().optional(),
  beatmap: z
    .object({
      id: z.number().int().positive(),
      version: z.string(),
      difficulty_rating: z.number().nullable().optional(),
    })
    .nullable()
    .optional(),
  beatmapset: z
    .object({
      id: z.number().int().positive(),
      title: z.string(),
      artist: z.string(),
    })
    .nullable()
    .optional(),
});
const scoresSchema = z.array(scoreSchema);

export class UpstreamResponseError extends Error {
  constructor(
    public readonly status: number,
    public readonly retryAfter: number | undefined,
    public readonly phase: "oauth" | "player" | "scores",
  ) {
    super(`osu! ${phase} request failed with ${status}`);
  }
}

export interface AccessToken {
  value: string;
  expiresAt: number;
}

function retryAfterSeconds(value: string | null, now = Date.now()): number | undefined {
  if (!value) return undefined;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return Math.ceil(numeric);
  const date = Date.parse(value);
  return Number.isFinite(date) && date > now ? Math.ceil((date - now) / 1000) : undefined;
}

async function checkedFetch(
  input: string,
  init: RequestInit,
  phase: UpstreamResponseError["phase"],
  fetcher: typeof fetch,
): Promise<Response> {
  const response = await fetcher(input, {
    ...init,
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new UpstreamResponseError(
      response.status,
      retryAfterSeconds(response.headers.get("Retry-After")),
      phase,
    );
  }
  return response;
}

export async function fetchAccessToken(
  credential: OAuthCredential,
  fetcher: typeof fetch = fetch,
): Promise<AccessToken> {
  const response = await checkedFetch(
    "https://osu.ppy.sh/oauth/token",
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: credential.clientId,
        client_secret: credential.clientSecret,
        grant_type: "client_credentials",
        scope: "public",
      }),
    },
    "oauth",
    fetcher,
  );
  const body = z
    .object({ access_token: z.string().min(1), expires_in: z.number().positive() })
    .parse(await response.json());
  return {
    value: body.access_token,
    expiresAt: Date.now() + Math.max(0, body.expires_in - 60) * 1000,
  };
}

export async function fetchBestScores(
  player: string,
  requestedMode: Ruleset | "auto",
  token: string,
  fetcher: typeof fetch = fetch,
): Promise<ScoresResponse> {
  const modePath = requestedMode === "auto" ? "" : `/${requestedMode}`;
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  };
  const userResponse = await checkedFetch(
    `https://osu.ppy.sh/api/v2/users/${encodeURIComponent(player)}${modePath}`,
    { headers },
    "player",
    fetcher,
  );
  const user = userSchema.parse(await userResponse.json());
  const mode: Ruleset = requestedMode === "auto" ? user.playmode : requestedMode;
  const scoresResponse = await checkedFetch(
    `https://osu.ppy.sh/api/v2/users/${user.id}/scores/best?mode=${mode}&limit=50&include_fails=0`,
    { headers },
    "scores",
    fetcher,
  );
  const scores = scoresSchema.parse(await scoresResponse.json());
  const statistics = user.statistics;

  return {
    player: {
      userId: user.id,
      username: user.username,
      country: user.country_code,
      avatarUrl: `/api/v1/assets/avatar/${user.id}`,
      pp: statistics?.pp ?? null,
      globalRank: statistics?.global_rank ?? null,
      hitAccuracy: statistics?.hit_accuracy ?? null,
      playTime: statistics?.play_time ?? null,
    },
    mode,
    type: "best",
    scores: scores.map((score) => {
      const beatmapsetId = score.beatmapset?.id ?? null;
      return {
        scoreId: score.id ?? null,
        beatmapId: score.beatmap?.id ?? null,
        beatmapsetId,
        beatmapTitle: score.beatmapset?.title ?? "Unknown beatmap",
        artist: score.beatmapset?.artist ?? "",
        version: score.beatmap?.version ?? "",
        coverUrl: beatmapsetId === null ? null : `/api/v1/assets/cover/${beatmapsetId}`,
        starRating: score.beatmap?.difficulty_rating ?? null,
        accuracy: score.accuracy,
        pp: score.pp ?? null,
        rank: score.rank === "X" ? "SS" : score.rank === "XH" ? "SSH" : score.rank,
        mods: score.mods.map((mod) => (typeof mod === "string" ? mod : mod.acronym)),
        maxCombo: score.max_combo,
        playedAt: score.ended_at ?? null,
      };
    }),
    fetchedAt: new Date().toISOString(),
  };
}
