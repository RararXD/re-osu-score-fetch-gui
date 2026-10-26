import { describe, expect, it } from "vitest";
import {
  CredentialPool,
  credentialSignature,
  parseCredentials,
} from "../worker/services/credential-pool";

describe("CredentialPool", () => {
  const credentials = parseCredentials(
    JSON.stringify([
      { clientId: "11", clientSecret: "first" },
      { clientId: "22", clientSecret: "second" },
      { clientId: "33", clientSecret: "third" },
    ]),
  );
  const signature = credentialSignature(credentials);

  it("rotates each successful cache miss without exposing credentials", () => {
    const pool = new CredentialPool(credentials.length, 60, undefined, signature);
    expect(pool.reserve(3, 1_000)).toEqual({ ok: true, slot: 0 });
    expect(pool.reserve(2, 1_001)).toEqual({ ok: true, slot: 1 });
    expect(pool.reserve(2, 1_002)).toEqual({ ok: true, slot: 2 });
    expect(pool.reserve(2, 1_003)).toEqual({ ok: true, slot: 0 });
  });

  it("skips a cooling credential and persists the next cursor", () => {
    const pool = new CredentialPool(credentials.length, 60, undefined, signature);
    pool.markCooldown(0, 20_000);
    expect(pool.reserve(3, 1_000)).toEqual({ ok: true, slot: 1 });

    const restored = new CredentialPool(
      credentials.length,
      60,
      pool.snapshot(signature),
      signature,
    );
    expect(restored.reserve(3, 1_001)).toEqual({ ok: true, slot: 2 });
  });

  it("reserves a token-aware number of requests for each slot", () => {
    const pool = new CredentialPool(2, 3, undefined, "1|2");
    expect(pool.reserve((slot) => (slot === 0 ? 3 : 2), 1_000)).toEqual({
      ok: true,
      slot: 0,
    });
    expect(pool.reserve((slot) => (slot === 0 ? 3 : 2), 1_001)).toEqual({
      ok: true,
      slot: 1,
    });
    expect(pool.reserve(2, 1_002)).toEqual({ ok: false, retryAfter: 60 });
  });

  it("rejects duplicate Client IDs", () => {
    expect(() =>
      parseCredentials(
        JSON.stringify([
          { clientId: "11", clientSecret: "first" },
          { clientId: 11, clientSecret: "second" },
        ]),
      ),
    ).toThrow("OAuth Client IDs must be unique");
  });
});
