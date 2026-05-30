import { describe, expect, it } from "vitest";
import { extractProjectSequence, formatProjectNumber } from "@/lib/utils/project-number";

describe("project number utils", () => {
  it("formats number with padding", () => {
    expect(formatProjectNumber(1, 2026)).toBe("PJ-2026-0001");
    expect(formatProjectNumber(123, 2026)).toBe("PJ-2026-0123");
  });

  it("extracts sequence safely", () => {
    expect(extractProjectSequence("PJ-2026-0009")).toBe(9);
    expect(extractProjectSequence("invalid")).toBe(0);
    expect(extractProjectSequence(undefined)).toBe(0);
  });
});
