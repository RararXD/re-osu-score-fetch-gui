import { describe, expect, it, vi } from "vitest";
import { fetchBestScores } from "../worker/services/osu-api";

describe("osu! API mapping", () => {
  it("maps public user and best score responses into the new contract", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          id: 2,
          username: "peppy",
          country_code: "AU",
          playmode: "osu",
          statistics: {
            pp: 123.45,
            global_rank: 12,
            hit_accuracy: 98.76,
            play_time: 3600,
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json([
          {
            id: 99,
            accuracy: 0.9876,
            pp: 321.5,
            rank: "XH",
            mods: [{ acronym: "HD" }, "DT"],
            max_combo: 1234,
            ended_at: "2026-10-26T00:00:00Z",
            beatmap: { id: 7, version: "Insane", difficulty_rating: 5.67 },
            beatmapset: { id: 8, title: "Song", artist: "Artist" },
          },
        ]),
      );

    const result = await fetchBestScores("peppy", "auto", "token", fetcher as typeof fetch);
    expect(result.mode).toBe("osu");
    expect(result.player.avatarUrl).toBe("/api/v1/assets/avatar/2");
    expect(result.scores[0]).toMatchObject({
      beatmapId: 7,
      beatmapsetId: 8,
      coverUrl: "/api/v1/assets/cover/8",
      rank: "SSH",
      mods: ["HD", "DT"],
    });
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "https://osu.ppy.sh/api/v2/users/2/scores/best?mode=osu&limit=50&include_fails=0",
      expect.any(Object),
    );
  });
});
