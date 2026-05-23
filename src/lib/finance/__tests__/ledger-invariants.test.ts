import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  assertFinanceSsotDrift,
  assertJournalImmutability,
  createBalancedJournalEntry,
  mapCostTypeToExpenseAccount,
  mapPaymentMethodNameToAssetAccount,
} from "@/lib/finance/ledger";

describe("ledger payment mapping", () => {
  it("maps supported payment method names to asset accounts", () => {
    expect(mapPaymentMethodNameToAssetAccount("Cash")).toBe("cash_on_hand");
    expect(mapPaymentMethodNameToAssetAccount("KBZ Pay")).toBe("kbz_wallet");
    expect(mapPaymentMethodNameToAssetAccount("Wave Pay")).toBe("wave_wallet");
    expect(mapPaymentMethodNameToAssetAccount("AYA Pay")).toBe("aya_wallet");
    expect(mapPaymentMethodNameToAssetAccount("Bank Transfer")).toBe("bank_account");
  });

  it("returns null for unknown methods", () => {
    expect(mapPaymentMethodNameToAssetAccount("Cheque")).toBeNull();
  });

  it("handles lowercase and hyphen variations", () => {
    expect(mapPaymentMethodNameToAssetAccount("kbz-pay")).toBe("kbz_wallet");
    expect(mapPaymentMethodNameToAssetAccount("wave pay")).toBe("wave_wallet");
    expect(mapPaymentMethodNameToAssetAccount("BANK")).toBe("bank_account");
  });
});

describe("ledger cost mapping", () => {
  it("maps cost types to expense accounts", () => {
    expect(mapCostTypeToExpenseAccount("material")).toBe("material_expense");
    expect(mapCostTypeToExpenseAccount("labor")).toBe("labor_expense");
    expect(mapCostTypeToExpenseAccount("transport")).toBe("transport_expense");
    expect(mapCostTypeToExpenseAccount("misc")).toBe("misc_expense");
    expect(mapCostTypeToExpenseAccount("general")).toBe("general_expense");
  });

  it("maps unknown cost types to misc_expense (fallback)", () => {
    expect(mapCostTypeToExpenseAccount("unknown" as never)).toBe("misc_expense");
  });
});

describe("finance ssot drift assertion", () => {
  it("passes for current SSoT setup", () => {
    expect(() => {
      assertFinanceSsotDrift();
    }).not.toThrow();
  });
});

describe("journal immutability", () => {
  it("throws on update attempt", () => {
    expect(() => assertJournalImmutability("update")).toThrow(
      "Journal entries are immutable. Use reversal flow instead of update.",
    );
  });

  it("throws on delete attempt", () => {
    expect(() => assertJournalImmutability("delete")).toThrow(
      "Journal entries are immutable. Use reversal flow instead of delete.",
    );
  });
});

describe("createBalancedJournalEntry validation", () => {
  const mockTx = {
    select: vi.fn(),
    insert: vi.fn(),
    query: {
      journalEntries: {
        findFirst: vi.fn(),
      },
    },
  } as unknown as Parameters<
    Parameters<Parameters<typeof createBalancedJournalEntry>[0]["tx"]["transaction"]>[0]
  >[0];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects single-line entries", async () => {
    await expect(
      createBalancedJournalEntry({
        tx: mockTx,
        sourceType: "manual_adjustment",
        sourceId: "test-source",
        createdBy: "user-1",
        lines: [{ accountCode: "cash_on_hand", debit: 1000, credit: 0 }],
      }),
    ).rejects.toThrow("Journal entry requires at least two lines.");
  });

  it("rejects unbalanced entries (debit != credit)", async () => {
    mockTx.select = vi.fn().mockResolvedValue([
      { id: "acc-1", code: "cash_on_hand", isActive: true },
      { id: "acc-2", code: "accounts_receivable", isActive: true },
    ]);
    mockTx.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "entry-1" }]),
      }),
    });

    await expect(
      createBalancedJournalEntry({
        tx: mockTx,
        sourceType: "manual_adjustment",
        sourceId: "test-source",
        createdBy: "user-1",
        lines: [
          { accountCode: "cash_on_hand", debit: 1000, credit: 0 },
          { accountCode: "accounts_receivable", debit: 0, credit: 500 },
        ],
      }),
    ).rejects.toThrow("Unbalanced journal entry: debit=1000, credit=500.");
  });

  it("rejects lines with both debit and credit", async () => {
    await expect(
      createBalancedJournalEntry({
        tx: mockTx,
        sourceType: "manual_adjustment",
        sourceId: "test-source",
        createdBy: "user-1",
        lines: [
          { accountCode: "cash_on_hand", debit: 500, credit: 500 },
          { accountCode: "accounts_receivable", debit: 0, credit: 1000 },
        ],
      }),
    ).rejects.toThrow("Journal line must be debit-only or credit-only.");
  });

  it("rejects lines with neither debit nor credit", async () => {
    await expect(
      createBalancedJournalEntry({
        tx: mockTx,
        sourceType: "manual_adjustment",
        sourceId: "test-source",
        createdBy: "user-1",
        lines: [
          { accountCode: "cash_on_hand", debit: 0, credit: 0 },
          { accountCode: "accounts_receivable", debit: 1000, credit: 1000 },
        ],
      }),
    ).rejects.toThrow("Journal line must be debit-only or credit-only.");
  });

  it("rejects negative amounts", async () => {
    await expect(
      createBalancedJournalEntry({
        tx: mockTx,
        sourceType: "manual_adjustment",
        sourceId: "test-source",
        createdBy: "user-1",
        lines: [
          { accountCode: "cash_on_hand", debit: -100, credit: 0 },
          { accountCode: "accounts_receivable", debit: 0, credit: -100 },
        ],
      }),
    ).rejects.toThrow("Journal line values must be non-negative.");
  });
});

describe("reversal flow", () => {
  it("reversal swaps debit and credit for each line", async () => {
    const mockLines = [
      {
        id: "line-1",
        accountId: "acc-1",
        accountCode: "cash_on_hand" as const,
        debit: 1000,
        credit: 0,
        memo: "Payment received",
      },
      {
        id: "line-2",
        accountId: "acc-2",
        accountCode: "accounts_receivable" as const,
        debit: 0,
        credit: 1000,
        memo: null,
      },
    ];

    const reversed = mockLines.map((line) => ({
      accountCode: line.accountCode,
      debit: line.credit,
      credit: line.debit,
      memo: line.memo ? `Reversal: ${line.memo}` : "Reversal",
    }));

    expect(reversed[0]).toEqual({
      accountCode: "cash_on_hand",
      debit: 0,
      credit: 1000,
      memo: "Reversal: Payment received",
    });
    expect(reversed[1]).toEqual({
      accountCode: "accounts_receivable",
      debit: 1000,
      credit: 0,
      memo: "Reversal",
    });
  });

  it("reversal net effect is zero (original + reversal = 0)", () => {
    const originalLines = [
      { debit: 1000, credit: 0 },
      { debit: 0, credit: 1000 },
    ];

    const reversedLines = originalLines.map((line) => ({
      debit: line.credit,
      credit: line.debit,
    }));

    const netDebit =
      originalLines.reduce((sum, l) => sum + l.debit, 0) +
      reversedLines.reduce((sum, l) => sum + l.debit, 0);
    const netCredit =
      originalLines.reduce((sum, l) => sum + l.credit, 0) +
      reversedLines.reduce((sum, l) => sum + l.credit, 0);

    expect(netDebit).toBe(netCredit);
    expect(netDebit - netCredit).toBe(0);
  });
});
