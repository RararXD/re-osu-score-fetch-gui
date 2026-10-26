import { describe, expect, it } from "vitest";
import type { ScoresResponse } from "../shared/contracts";
import { normalizePlayer, scoreCacheKey, sliceScores } from "../worker/services/cache";

describe("score cache helpers", () => {
  it("normalizes player names and numeric IDs without path semantics", () => {
    expect(normalizePlayer("  Peppy  ")).toBe("peppy");
    expect(normalizePlayer("000123")).toBe("123");
    expect(scoreCacheKey({ player: "Peppy", mode: "mania" })).toBe("scores:v1:mania:peppy");
  });

  it("stores B50 once and slices B20 without mutating the cached value", () => {
    const data = {
      player: {},
      mode: "mania",
      type: "best",
      fetchedAt: "2026-10-26T00:00:00.000Z",
      scores: Array.from({ length: 50 }, (_, index) => ({ scoreId: index })),
    } as unknown as ScoresResponse;
    const selected = sliceScores(data, 20);
    expect(selected.scores).toHaveLength(20);
    expect(data.scores).toHaveLength(50);
  });
});
