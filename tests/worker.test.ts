import { abortAllDurableObjects, reset, SELF } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(async () => {
  vi.restoreAllMocks();
  await abortAllDurableObjects();
  await reset();
});

describe("Worker entrypoint", () => {
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
