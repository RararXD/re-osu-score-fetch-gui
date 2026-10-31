import { abortAllDurableObjects, reset, runInDurableObject, SELF } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OsuGateway } from "../worker/durable-objects/osu-gateway";
import type { Env } from "../worker/env";

afterEach(async () => {
  vi.restoreAllMocks();
  await reset();
  await abortAllDurableObjects();
});

describe("Worker entrypoint", () => {
  const bindings = env as unknown as Env;
  const gateway = () => bindings.OSU_GATEWAY.get(bindings.OSU_GATEWAY.idFromName("global"));

  it("bounds concurrent cache misses without sending rejected queries upstream", async () => {
    await runInDurableObject(gateway(), async (instance: OsuGateway) => {
      let release: () => void = () => undefined;
      let entered: () => void = () => undefined;
      const pending = new Promise<void>((resolve) => {
        release = resolve;
      });
      const started = new Promise<void>((resolve) => {
        entered = resolve;
      });
      const upstream = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
        const url = String(input);
        if (url.endsWith("/oauth/token")) {
          entered();
          await pending;
          return Response.json({ access_token: "test-token", expires_in: 3600 });
        }
        if (url.includes("/scores/best")) return Response.json([]);
        return Response.json({ id: 2, username: "Player", country_code: "CN", playmode: "osu" });
      });
      const query = (player: string) =>
        instance.fetch(
          new Request("https://osu-gateway.internal/query", {
            method: "POST",
            body: JSON.stringify({ player }),
          }),
        );
      const first = query("First");
      await started;
      const queued = Array.from({ length: 7 }, (_, index) => query(`Queued${index}`));
      try {
        const rejected = await query("Rejected");
        expect(rejected.status).toBe(503);
        expect(rejected.headers.get("Retry-After")).toBe("5");
        expect(upstream).toHaveBeenCalledOnce();
      } finally {
        release();
        const completed = await Promise.all([first, ...queued]);
        expect(completed.every((response) => response.status === 200)).toBe(true);
      }
    });
  });

  it("stops all credentials after an upstream 429 and persists the cooldown", async () => {
    const upstream = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 429, headers: { "Retry-After": "120" } }));
    const first = await SELF.fetch("https://example.com/api/v1/scores?player=Limited");
    expect(first.status).toBe(503);
    expect(first.headers.get("Retry-After")).toBe("120");
    expect(upstream).toHaveBeenCalledTimes(1);
    await abortAllDurableObjects();
    const second = await SELF.fetch("https://example.com/api/v1/scores?player=Another");
    expect(second.status).toBe(503);
    expect(Number(second.headers.get("Retry-After"))).toBeGreaterThan(110);
    expect(upstream).toHaveBeenCalledTimes(1);
  });

  it("uses one persisted budget across credentials and still serves cached scores", async () => {
    await runInDurableObject(gateway(), async (_instance, state) => {
      await state.storage.put("upstream-budget-v1", {
        requestTimes: Array.from({ length: 30 }, () => Date.now()),
        cooldownUntil: 0,
      });
    });
    await bindings.SCORE_CACHE.put(
      "scores:v1:auto:cached",
      JSON.stringify({
        data: { player: { username: "Cached" }, scores: [] },
        expiresAt: Date.now() + 180_000,
      }),
    );
    const upstream = vi.spyOn(globalThis, "fetch");
    const blocked = await SELF.fetch("https://example.com/api/v1/scores?player=Uncached");
    expect(blocked.status).toBe(503);
    expect(Number(blocked.headers.get("Retry-After"))).toBeGreaterThan(50);
    const cached = await SELF.fetch("https://example.com/api/v1/scores?player=Cached");
    expect(cached.status).toBe(200);
    expect(cached.headers.get("X-Cache")).toBe("HIT");
    expect(upstream).not.toHaveBeenCalled();
  });

  it("charges failed upstream calls before sending them", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("network failed"));
    const response = await SELF.fetch("https://example.com/api/v1/scores?player=Failure");
    expect(response.status).toBe(502);
    const budget = await runInDurableObject(gateway(), (_instance, state) =>
      state.storage.get<{ requestTimes: number[] }>("upstream-budget-v1"),
    );
    expect(budget?.requestTimes).toHaveLength(1);
  });

  it("never multiplies the 30-request budget by the number of credentials", async () => {
    const upstream = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/oauth/token")) {
        return Response.json({ access_token: "test-token", expires_in: 3600 });
      }
      if (url.includes("/scores/best")) return Response.json([]);
      return Response.json({ id: 2, username: "Player", country_code: "CN", playmode: "osu" });
    });
    const query = (player: string) =>
      gateway().fetch("https://osu-gateway.internal/query", {
        method: "POST",
        body: JSON.stringify({ player }),
      });
    for (let index = 0; index < 14; index += 1) {
      const response = await query(`Player${index}`);
      expect(response.status).toBe(200);
      await response.arrayBuffer();
    }
    expect(upstream).toHaveBeenCalledTimes(30);
    const blocked = await query("OverBudget");
    expect(blocked.status).toBe(503);
    expect(Number(blocked.headers.get("Retry-After"))).toBeGreaterThan(50);
    expect(upstream).toHaveBeenCalledTimes(30);
  });

  it("serves a health response from the Workers runtime", async () => {
    const response = await SELF.fetch("https://example.com/health");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "ok",
      modes: ["osu", "taiko", "fruits", "mania"],
    });
  });

  it("rejects malformed score queries before calling osu!", async () => {
    const response = await SELF.fetch(
      "https://example.com/api/v1/scores?player=&mode=catch&limit=21",
    );
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: {
        code: "INVALID_REQUEST",
        message: "请检查玩家名称、模式和 Best 数量。",
      },
    });
  });

  it("rotates site credentials while cached queries bypass the gateway", async () => {
    const oauthClientIds: string[] = [];
    const upstream = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.endsWith("/oauth/token")) {
        const body = new URLSearchParams(String(init?.body));
        const clientId = body.get("client_id") ?? "";
        oauthClientIds.push(clientId);
        return Response.json({ access_token: `token-${clientId}`, expires_in: 3600 });
      }
      if (url.includes("/scores/best")) return Response.json([]);
      const player = decodeURIComponent(new URL(url).pathname.split("/").at(-1) ?? "player");
      return Response.json({
        id: player === "Alpha" ? 1 : 2,
        username: player,
        country_code: "CN",
        playmode: "mania",
        statistics: null,
      });
    });

    const first = await SELF.fetch(
      "https://example.com/api/v1/scores?player=Alpha&mode=auto&limit=20",
    );
    const second = await SELF.fetch(
      "https://example.com/api/v1/scores?player=Beta&mode=auto&limit=20",
    );
    const cached = await SELF.fetch(
      "https://example.com/api/v1/scores?player=Alpha&mode=auto&limit=50",
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.headers.get("X-Cache")).toBe("MISS");
    expect(second.headers.get("X-Cache")).toBe("MISS");
    expect(cached.headers.get("X-Cache")).toBe("HIT");
    expect(oauthClientIds).toEqual(["1", "2"]);
    expect(upstream).toHaveBeenCalledTimes(6);
  });

  it("isolates a 401 token failure to its selected credential", async () => {
    const playerAttempts: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const authorization = new Headers(init?.headers).get("Authorization") ?? "";
      if (url.endsWith("/oauth/token")) {
        const clientId = new URLSearchParams(String(init?.body)).get("client_id");
        return Response.json({ access_token: `token-${clientId}`, expires_in: 3600 });
      }
      if (url.includes("/scores/best")) return Response.json([]);
      const player = decodeURIComponent(new URL(url).pathname.split("/").at(-1) ?? "player");
      playerAttempts.push(`${player}:${authorization}`);
      if (player === "Gamma" && authorization === "Bearer token-1") {
        return Response.json({ error: "unauthorized" }, { status: 401 });
      }
      return Response.json({
        id: player === "Alpha" ? 1 : player === "Beta" ? 2 : 3,
        username: player,
        country_code: "CN",
        playmode: "mania",
        statistics: null,
      });
    });

    await SELF.fetch("https://example.com/api/v1/scores?player=Alpha");
    await SELF.fetch("https://example.com/api/v1/scores?player=Beta");
    const response = await SELF.fetch("https://example.com/api/v1/scores?player=Gamma");

    expect(response.status).toBe(200);
    expect((await response.json()) as { player: { username: string } }).toMatchObject({
      player: { username: "Gamma" },
    });
    expect(playerAttempts).toContain("Gamma:Bearer token-1");
    expect(playerAttempts).toContain("Gamma:Bearer token-2");
  });
});
