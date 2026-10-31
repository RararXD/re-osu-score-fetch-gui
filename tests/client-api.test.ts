import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, fetchScores, parseRetryAfter } from "../src/lib/api";

afterEach(() => vi.restoreAllMocks());

describe("browser API client", () => {
  it("honors long delays, zero and HTTP-date Retry-After headers", () => {
    expect(parseRetryAfter("300")).toBe(300);
    expect(parseRetryAfter("0")).toBe(0);
    expect(parseRetryAfter("Thu, 01 Jan 1970 00:02:00 GMT", 60_000)).toBe(60);
    expect(parseRetryAfter(null)).toBe(5);
    expect(parseRetryAfter("invalid")).toBe(5);
  });

  it("keeps an absolute retry deadline for a rate limit response", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1000);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(
        { error: { code: "RATE_LIMITED" } },
        {
          status: 429,
          headers: { "Retry-After": "300" },
        },
      ),
    );
    await expect(
      fetchScores("peppy", "auto", 50, new AbortController().signal),
    ).rejects.toMatchObject({
      code: "RATE_LIMITED",
      retryAfter: 300,
      retryAt: 301_000,
    });
  });

  it("handles non-contract errors without throwing a property access error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({}, { status: 503 }));
    await expect(
      fetchScores("peppy", "auto", 50, new AbortController().signal),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("does not treat a missing cache TTL as zero", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ scores: [] }));
    const result = await fetchScores("peppy", "auto", 50, new AbortController().signal);
    expect(result.refreshAt).toBeNull();
  });
});
