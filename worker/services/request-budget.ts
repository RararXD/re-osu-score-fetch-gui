export interface RequestBudgetSnapshot {
  requestTimes: number[];
  cooldownUntil: number;
}

// Used only inside the gateway's serialized request handler.
export class RequestBudget {
  private readonly state: RequestBudgetSnapshot;

  constructor(
    private readonly limit: number,
    snapshot?: RequestBudgetSnapshot,
  ) {
    this.state = snapshot ?? { requestTimes: [], cooldownUntil: 0 };
  }

  retryAfter(required: number, now: number): number {
    this.state.requestTimes = this.state.requestTimes.filter((time) => time > now - 60_000);
    const releaseIndex = this.state.requestTimes.length + required - this.limit - 1;
    const availableAt = Math.max(
      this.state.cooldownUntil,
      releaseIndex >= 0 ? this.state.requestTimes[releaseIndex] + 60_000 : 0,
    );
    return Math.max(0, Math.ceil((availableAt - now) / 1000));
  }

  record(now: number): void {
    this.state.requestTimes.push(now);
  }

  coolDown(until: number): void {
    this.state.cooldownUntil = Math.max(this.state.cooldownUntil, until);
  }

  snapshot(): RequestBudgetSnapshot {
    return { ...this.state, requestTimes: [...this.state.requestTimes] };
  }
}
