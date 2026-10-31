import { describe, expect, it } from "vitest";
import { RequestBudget } from "../worker/services/request-budget";

describe("shared upstream budget", () => {
  it("counts actual requests in a rolling minute and releases at the boundary", () => {
    const budget = new RequestBudget(3);
    budget.record(1000);
    budget.record(2000);
    budget.record(3000);
    expect(budget.retryAfter(1, 3000)).toBe(58);
    expect(budget.retryAfter(2, 61_000)).toBe(1);
    expect(budget.retryAfter(1, 61_000)).toBe(0);
    expect(budget.retryAfter(3, 63_000)).toBe(0);
  });

  it("requires both cooldown and request capacity to become available", () => {
    const budget = new RequestBudget(3);
    budget.record(1000);
    budget.coolDown(10_000);
    expect(budget.retryAfter(3, 2000)).toBe(59);
    budget.coolDown(70_000);
    expect(budget.retryAfter(3, 2000)).toBe(68);
  });

  it("restores capacity and cooldown independently of credential changes", () => {
    const budget = new RequestBudget(3);
    budget.record(1000);
    budget.coolDown(90_000);
    const restored = new RequestBudget(3, budget.snapshot());
    expect(restored.retryAfter(1, 60_000)).toBe(30);
    expect(restored.retryAfter(3, 90_000)).toBe(0);
  });
});
