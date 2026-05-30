import { describe, expect, it } from "vitest";
import { extractQuoteSequence, formatQuoteNumber } from "@/lib/utils/quote-number";

describe("quote number utils", () => {
  it("formats quote number", () => {
    expect(formatQuoteNumber(1, 2026)).toBe("QT-2026-0001");
    expect(formatQuoteNumber(42, 2026)).toBe("QT-2026-0042");
  });

  it("extracts sequence safely", () => {
    expect(extractQuoteSequence("QT-2026-0500")).toBe(500);
    expect(extractQuoteSequence("bad")).toBe(0);
    expect(extractQuoteSequence(undefined)).toBe(0);
  });
});
