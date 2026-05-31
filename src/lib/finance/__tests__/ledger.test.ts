import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import {
  assertFinanceSsotDrift,
  createBalancedJournalEntry,
  mapCostTypeToExpenseAccount,
  mapPaymentMethodNameToAssetAccount,
} from "@/lib/finance/ledger";

describe("ledger payment mapping", () => {
  it("maps supported payment method names to asset accounts", () => {
    expect(mapPaymentMethodNameToAssetAccount("Cash")).toBe("cash_on_hand");
    expect(mapPaymentMethodNameToAssetAccount("KBZ Banking")).toBe("kbz_banking");
    expect(mapPaymentMethodNameToAssetAccount("KBZ Pay")).toBe("kbz_wallet");
    expect(mapPaymentMethodNameToAssetAccount("AYA Banking")).toBe("aya_banking");
    expect(mapPaymentMethodNameToAssetAccount("AYA Pay")).toBe("aya_wallet");
    expect(mapPaymentMethodNameToAssetAccount("CB Banking")).toBe("cb_banking");
    expect(mapPaymentMethodNameToAssetAccount("CB Pay")).toBe("cb_wallet");
    expect(mapPaymentMethodNameToAssetAccount("Wave Pay")).toBe("wave_wallet");
  });

  it("returns null for unknown methods", () => {
    expect(mapPaymentMethodNameToAssetAccount("Cheque")).toBeNull();
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
});

describe("finance ssot drift assertion", () => {
  it("passes for current SSoT setup", () => {
    expect(() => {
      assertFinanceSsotDrift();
    }).not.toThrow();
  });
});

describe("createBalancedJournalEntry", () => {
  let mockWhere: Mock;

  const mockTx = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: (cond: unknown) => mockWhere(cond),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => {
        const chain = {
          returning: vi.fn(async () => [{ id: "je-1" }]),
          // biome-ignore lint/suspicious/noThenProperty: mock thenable
          then: (resolve: (v: unknown) => unknown) => Promise.resolve(resolve(undefined)),
        };
        return chain;
      }),
    })),
    query: {
      accountingPeriods: {
        findFirst: vi.fn(async () => null),
      },
    },
  } as unknown as Parameters<typeof createBalancedJournalEntry>[0]["tx"];

  beforeEach(() => {
    vi.clearAllMocks();
    mockWhere = vi.fn().mockResolvedValue([
      { id: "acc1", code: "cash_on_hand", isActive: true },
      { id: "acc2", code: "solar_installation_revenue", isActive: true },
    ]);
  });

  it("persists balanced whole-MMK entry", async () => {
    const res = await createBalancedJournalEntry({
      tx: mockTx,
      sourceType: "manual_adjustment",
      sourceId: "src1",
      createdBy: "u1",
      lines: [
        { accountCode: "cash_on_hand", debit: 1000, credit: 0 },
        { accountCode: "solar_installation_revenue", debit: 0, credit: 1000 },
      ],
    });
    expect(res.entryId).toBe("je-1");
  });

  it("rejects decimal entries that unbalance after rounding", async () => {
    await expect(
      createBalancedJournalEntry({
        tx: mockTx,
        sourceType: "manual_adjustment",
        sourceId: "src1",
        createdBy: "u1",
        lines: [
          { accountCode: "cash_on_hand", debit: 1000.4, credit: 0 }, // rounds to 1000
          { accountCode: "solar_installation_revenue", debit: 0, credit: 1000.6 }, // rounds to 1001
        ],
      }),
    ).rejects.toThrow(/Unbalanced journal entry/);
  });

  it("accepts valid decimal entries if they balance after rounding", async () => {
    const res = await createBalancedJournalEntry({
      tx: mockTx,
      sourceType: "manual_adjustment",
      sourceId: "src1",
      createdBy: "u1",
      lines: [
        { accountCode: "cash_on_hand", debit: 1000.2, credit: 0 }, // rounds to 1000
        { accountCode: "solar_installation_revenue", debit: 0, credit: 1000.4 }, // rounds to 1000
      ],
    });
    expect(res.entryId).toBe("je-1");
  });

  it("accepts repeated account codes in compound entry", async () => {
    const res = await createBalancedJournalEntry({
      tx: mockTx,
      sourceType: "manual_adjustment",
      sourceId: "src1",
      createdBy: "u1",
      lines: [
        { accountCode: "cash_on_hand", debit: 500, credit: 0 },
        { accountCode: "cash_on_hand", debit: 500, credit: 0 },
        { accountCode: "solar_installation_revenue", debit: 0, credit: 1000 },
      ],
    });
    expect(res.entryId).toBe("je-1");
  });
});
