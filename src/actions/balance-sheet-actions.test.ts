import { beforeEach, describe, expect, it, vi } from "vitest";
import { getBalanceSheet } from "@/actions/balance-sheet-actions";

const state = vi.hoisted(() => ({
  role: "owner" as "owner" | "admin" | "standard",
  journalLines: [] as { code: string; balance: number }[],
}));

vi.mock("@/lib/auth/validate", () => ({
  requireOwner: vi.fn(async () => {
    if (state.role !== "owner") throw new Error("Unauthorized");
    return { userId: "owner1" };
  }),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          innerJoin: vi.fn(() => ({
            where: vi.fn(() => ({
              groupBy: vi.fn(async () => state.journalLines),
            })),
          })),
        })),
      })),
    })),
  },
}));

describe("balance-sheet-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.role = "owner";
    state.journalLines = [];
  });

  describe("getBalanceSheet", () => {
    it("fails if not owner", async () => {
      state.role = "admin";
      const res = await getBalanceSheet();
      expect(res.success).toBe(false);
    });

    it("returns empty balance sheet when no data", async () => {
      const res = await getBalanceSheet();
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.isBalanced).toBe(true);
        expect(res.data.totalLiabilitiesAndEquity).toBe(0);
        expect(res.data.assets.totalAssets).toBe(0);
        expect(res.data.equity.retainedEarnings).toBe(0);
      }
    });

    it("calculates retained earnings from income and expense", async () => {
      state.journalLines = [
        { code: "solar_installation_revenue", balance: -5000 }, // Income (credit)
        { code: "cost_of_goods_sold", balance: 2000 }, // Expense (debit)
        { code: "cash_on_hand", balance: 3000 }, // Asset
      ];
      const res = await getBalanceSheet();
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.equity.retainedEarnings).toBe(3000); // 5000 - 2000
        expect(res.data.assets.totalAssets).toBe(3000);
        expect(res.data.totalLiabilitiesAndEquity).toBe(3000); // Equity 3000
        expect(res.data.isBalanced).toBe(true);
      }
    });

    it("classifies liabilities correctly", async () => {
      state.journalLines = [
        { code: "accounts_payable", balance: -1000 },
        { code: "cash_on_hand", balance: 1000 },
      ];
      const res = await getBalanceSheet();
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.liabilities.totalLiabilities).toBe(1000);
        expect(res.data.assets.totalAssets).toBe(1000);
        expect(res.data.isBalanced).toBe(true);
      }
    });

    it("reports imbalanced if accounting is broken", async () => {
      state.journalLines = [
        { code: "accounts_payable", balance: -1000 },
        { code: "cash_on_hand", balance: 500 }, // Imbalanced!
      ];
      const res = await getBalanceSheet();
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.isBalanced).toBe(false);
      }
    });
  });
});
