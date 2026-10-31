import { z } from "zod";

const credentialSchema = z.object({
  clientId: z
    .union([z.string(), z.number().int().positive()])
    .transform(String)
    .refine((value) => /^[1-9]\d*$/u.test(value)),
  clientSecret: z.string().trim().min(1),
});

const credentialsSchema = z.array(credentialSchema).min(1).max(16);

export interface OAuthCredential {
  clientId: string;
  clientSecret: string;
}

export interface CredentialSlotState {
  requestTimes: number[];
  cooldownUntil: number;
  disabledUntil: number;
}

export interface CredentialPoolSnapshot {
  signature: string;
  cursor: number;
  slots: CredentialSlotState[];
}

export type Reservation = { ok: true; slot: number } | { ok: false; retryAfter: number };

export function parseCredentials(raw: string | undefined): OAuthCredential[] {
  if (!raw) return [];
  const parsed = credentialsSchema.parse(JSON.parse(raw));
  const seen = new Set<string>();
  for (const credential of parsed) {
    if (seen.has(credential.clientId)) {
      throw new Error("OAuth Client IDs must be unique");
    }
    seen.add(credential.clientId);
  }
  return parsed;
}

export function credentialSignature(credentials: OAuthCredential[]): string {
  return credentials.map(({ clientId }) => clientId).join("|");
}

export class CredentialPool {
  private cursor: number;
  private readonly slots: CredentialSlotState[];

  constructor(
    private readonly count: number,
    private readonly requestsPerMinute: number,
    snapshot?: CredentialPoolSnapshot,
    signature = "",
  ) {
    const compatible =
      snapshot?.signature === signature &&
      Number.isFinite(snapshot.cursor) &&
      snapshot.slots.length === count &&
      snapshot.slots.every(
        (slot) =>
          Array.isArray(slot.requestTimes) &&
          Number.isFinite(slot.cooldownUntil) &&
          Number.isFinite(slot.disabledUntil),
      );
    this.cursor = compatible ? snapshot.cursor % Math.max(1, count) : 0;
    this.slots = compatible
      ? snapshot.slots.map((slot) => ({ ...slot, requestTimes: [...slot.requestTimes] }))
      : Array.from({ length: count }, () => ({
          requestTimes: [],
          cooldownUntil: 0,
          disabledUntil: 0,
        }));
  }

  reserve(requiredRequests: number | ((slot: number) => number), now: number): Reservation {
    if (this.count === 0) return { ok: false, retryAfter: 60 };
    const cutoff = now - 60_000;
    let earliestAvailable = Number.POSITIVE_INFINITY;

    for (let offset = 0; offset < this.count; offset += 1) {
      const index = (this.cursor + offset) % this.count;
      const slot = this.slots[index];
      const required =
        typeof requiredRequests === "function" ? requiredRequests(index) : requiredRequests;
      slot.requestTimes = slot.requestTimes.filter((time) => time > cutoff);
      let blockedUntil = Math.max(slot.cooldownUntil, slot.disabledUntil);
      if (slot.requestTimes.length + required > this.requestsPerMinute) {
        const releaseIndex = slot.requestTimes.length + required - this.requestsPerMinute - 1;
        const releaseAt = slot.requestTimes[Math.max(0, releaseIndex)] + 60_000;
        blockedUntil = Math.max(blockedUntil, releaseAt);
      }
      if (blockedUntil > now) {
        earliestAvailable = Math.min(earliestAvailable, blockedUntil);
        continue;
      }

      slot.requestTimes.push(...Array.from({ length: required }, () => now));
      this.cursor = (index + 1) % this.count;
      return { ok: true, slot: index };
    }

    const retryAfter = Number.isFinite(earliestAvailable)
      ? Math.max(1, Math.ceil((earliestAvailable - now) / 1000))
      : 60;
    return { ok: false, retryAfter };
  }

  markCooldown(slot: number, until: number): void {
    this.slots[slot].cooldownUntil = Math.max(this.slots[slot].cooldownUntil, until);
  }

  markAuthenticationFailure(slot: number, now: number): void {
    this.slots[slot].disabledUntil = Math.max(this.slots[slot].disabledUntil, now + 300_000);
  }

  snapshot(signature: string): CredentialPoolSnapshot {
    return {
      signature,
      cursor: this.cursor,
      slots: this.slots.map((slot) => ({ ...slot, requestTimes: [...slot.requestTimes] })),
    };
  }
}
