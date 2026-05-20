import { describe, expect, it } from "vitest";
import { extractSequence, formatQuoteNumber } from "@/lib/utils/quote-number";

describe("quote number utils", () => {
  it("formats quote number", () => {
    expect(formatQuoteNumber(1, 2026)).toBe("QT-2026-0001");
    expect(formatQuoteNumber(42, 2026)).toBe("QT-2026-0042");
  });

  it("extracts sequence safely", () => {
    expect(extractSequence("QT-2026-0500")).toBe(500);
    expect(extractSequence("bad")).toBe(0);
    expect(extractSequence(undefined)).toBe(0);
  });
});
