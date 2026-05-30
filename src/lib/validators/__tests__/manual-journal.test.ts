import { describe, expect, it } from "vitest";
import { manualJournalSchema } from "../manual-journal";

describe("manualJournalSchema", () => {
  const validEntry = {
    entryDate: new Date("2026-05-24T00:00:00.000Z"),
    memo: "Valid Adjustment",
    sourceType: "manual_adjustment",
    lines: [
      {
        accountCode: "cash_on_hand",
        debit: 100000,
        credit: 0,
        memo: "Debit side",
      },
      {
        accountCode: "owner_equity",
        debit: 0,
        credit: 100000,
        memo: "Credit side",
      },
    ],
  };

  it("accepts valid balanced manual journal entries", () => {
    const result = manualJournalSchema.safeParse(validEntry);
    expect(result.success).toBe(true);
  });

  it("rejects journal entries with less than 2 lines", () => {
    const result = manualJournalSchema.safeParse({
      ...validEntry,
      lines: [
        {
          accountCode: "cash_on_hand",
          debit: 100000,
          credit: 0,
        },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("at least two lines");
    }
  });

  it("rejects unbalanced entries (debit !== credit)", () => {
    const result = manualJournalSchema.safeParse({
      ...validEntry,
      lines: [
        {
          accountCode: "cash_on_hand",
          debit: 100000,
          credit: 0,
        },
        {
          accountCode: "owner_equity",
          debit: 0,
          credit: 99999, // Unbalanced by 1 MMK
        },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("Entry is unbalanced");
    }
  });

  it("rejects lines with both debit and credit positive", () => {
    const result = manualJournalSchema.safeParse({
      ...validEntry,
      lines: [
        {
          accountCode: "cash_on_hand",
          debit: 50000,
          credit: 50000, // Invalid: cannot be both
        },
        {
          accountCode: "owner_equity",
          debit: 0,
          credit: 100000,
        },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("debit-only or credit-only");
    }
  });

  it("rejects lines with neither debit nor credit positive", () => {
    const result = manualJournalSchema.safeParse({
      ...validEntry,
      lines: [
        {
          accountCode: "cash_on_hand",
          debit: 0,
          credit: 0, // Invalid: cannot be neither
        },
        {
          accountCode: "owner_equity",
          debit: 0,
          credit: 100000,
        },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("debit-only or credit-only");
    }
  });
});
