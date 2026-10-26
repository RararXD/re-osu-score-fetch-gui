import { z } from "zod";

export const rulesetSchema = z.enum(["osu", "taiko", "fruits", "mania"]);
export const queryModeSchema = z.enum(["auto", "osu", "taiko", "fruits", "mania"]);

export type Ruleset = z.infer<typeof rulesetSchema>;
export type QueryMode = z.infer<typeof queryModeSchema>;

export const scoreQuerySchema = z.object({
  player: z
    .string()
    .trim()
    .min(1)
    .max(32)
    .refine(
      (value) =>
        Array.from(value).every((character) => {
          const code = character.charCodeAt(0);
          return code >= 32 && !"\\/?#".includes(character);
        }),
      "Invalid player",
    ),
  mode: queryModeSchema.default("auto"),
  limit: z.coerce
    .number()
    .refine((value) => value === 20 || value === 50)
    .default(20),
});

export type ScoreQuery = z.infer<typeof scoreQuerySchema>;

export interface Player {
  userId: number;
  username: string;
  country: string;
  avatarUrl: string;
  pp: number | null;
  globalRank: number | null;
  hitAccuracy: number | null;
  playTime: number | null;
}

export interface Score {
  scoreId: number | null;
  beatmapId: number | null;
  beatmapsetId: number | null;
  beatmapTitle: string;
  artist: string;
  version: string;
  coverUrl: string | null;
  starRating: number | null;
  accuracy: number;
  pp: number | null;
  rank: string;
  mods: string[];
  maxCombo: number;
  playedAt: string | null;
}

export interface ScoresResponse {
  player: Player;
  mode: Ruleset;
  type: "best";
  scores: Score[];
  fetchedAt: string;
}

export type ErrorCode =
  | "INVALID_REQUEST"
  | "PLAYER_NOT_FOUND"
  | "RATE_LIMITED"
  | "NOT_CONFIGURED"
  | "UPSTREAM_BUSY"
  | "UPSTREAM_ERROR"
  | "IMAGE_UNAVAILABLE"
  | "INTERNAL_ERROR";

export interface ErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
  };
}

export interface ScoreCacheEntry {
  data: ScoresResponse;
  expiresAt: number;
}
