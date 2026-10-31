import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../worker/app";
import type { Env } from "../worker/env";

function bindings() {
  return {
    IP_RATE_LIMITER: { limit: vi.fn().mockResolvedValue({ success: true }) },
    PLAYER_RATE_LIMITER: { limit: vi.fn().mockResolvedValue({ success: true }) },
    ASSET_IP_RATE_LIMITER: { limit: vi.fn().mockResolvedValue({ success: true }) },
    ASSET_UPSTREAM_RATE_LIMITER: { limit: vi.fn().mockResolvedValue({ success: true }) },
    SCORE_CACHE: { get: vi.fn().mockResolvedValue(null) },
  };
}

afterEach(() => vi.restoreAllMocks());

describe("API admission limits", () => {
  it("limits invalid queries before validation or cache work", async () => {
    const env = bindings();
    env.IP_RATE_LIMITER.limit.mockResolvedValue({ success: false });
    const response = await app.request(
      "https://example.com/api/v1/scores?player=",
      {
        headers: { "CF-Connecting-IP": "192.0.2.1" },
      },
      env as unknown as Env,
    );
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(env.IP_RATE_LIMITER.limit).toHaveBeenCalledWith({ key: "192.0.2.1" });
    expect(env.SCORE_CACHE.get).not.toHaveBeenCalled();
  });

  it("serves cached scores without using the player miss allowance", async () => {
    const env = bindings();
    env.PLAYER_RATE_LIMITER.limit.mockResolvedValue({ success: false });
    env.SCORE_CACHE.get.mockResolvedValue({
      data: { scores: [] },
      expiresAt: Date.now() + 60_000,
    });
    const response = await app.request(
      "https://example.com/api/v1/scores?player=Cached",
      {},
      env as unknown as Env,
    );
    expect(response.status).toBe(200);
    expect(env.PLAYER_RATE_LIMITER.limit).not.toHaveBeenCalled();
    expect(env.IP_RATE_LIMITER.limit).toHaveBeenCalledOnce();
  });

  it("limits normalized player cache misses before the gateway", async () => {
    const env = bindings();
    env.PLAYER_RATE_LIMITER.limit.mockResolvedValue({ success: false });
    const response = await app.request(
      "https://example.com/api/v1/scores?player=000123",
      {},
      env as unknown as Env,
    );
    expect(response.status).toBe(429);
    expect(env.PLAYER_RATE_LIMITER.limit).toHaveBeenCalledWith({ key: "123" });
  });

  it("limits image requests before contacting the origin", async () => {
    const env = bindings();
    env.ASSET_IP_RATE_LIMITER.limit.mockResolvedValue({ success: false });
    const upstream = vi.spyOn(globalThis, "fetch");
    const response = await app.request(
      "https://example.com/api/v1/assets/avatar/2",
      {},
      env as unknown as Env,
    );
    expect(response.status).toBe(429);
    expect(upstream).not.toHaveBeenCalled();
    expect(env.ASSET_UPSTREAM_RATE_LIMITER.limit).not.toHaveBeenCalled();
  });

  it("reuses the image cache across query-string variants without spending miss allowance", async () => {
    const env = bindings();
    const upstream = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("image", {
        headers: { "Content-Type": "image/png" },
      }),
    );
    const url = `https://example.com/api/v1/assets/avatar/${Date.now()}`;
    const ctx = createExecutionContext();
    const first = await app.request(`${url}?v=1`, {}, env as unknown as Env, ctx);
    expect(first.status).toBe(200);
    await waitOnExecutionContext(ctx);
    const cached = await app.request(
      `${url}?v=2`,
      {},
      env as unknown as Env,
      createExecutionContext(),
    );
    expect(cached.headers.get("X-Cache")).toBe("HIT");
    expect(upstream).toHaveBeenCalledOnce();
    expect(env.ASSET_IP_RATE_LIMITER.limit).toHaveBeenCalledTimes(2);
    expect(env.ASSET_UPSTREAM_RATE_LIMITER.limit).toHaveBeenCalledOnce();
  });
});
