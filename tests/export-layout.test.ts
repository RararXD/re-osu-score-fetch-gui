import { describe, expect, it } from "vitest";
import { exportLayout } from "../src/features/export/layout";

describe("score export layout", () => {
  it("uses two columns for B20", () => {
    expect(exportLayout(20, 20)).toMatchObject({ columns: 2, rows: 10 });
  });

  it("uses five columns for B50", () => {
    expect(exportLayout(50, 50)).toMatchObject({ columns: 5, rows: 10 });
  });

  it("keeps an empty export tall enough for its header and footer", () => {
    expect(exportLayout(0, 20).rows).toBe(1);
  });
});
