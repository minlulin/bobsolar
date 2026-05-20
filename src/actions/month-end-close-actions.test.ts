import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  financeAllowed: true,
  rowsQueue: [] as Array<Array<Record<string, unknown>>>,
}));

vi.mock("@/lib/auth/validate", () => ({
  requireFinanceAccess: vi.fn(async () => {
    if (!state.financeAllowed) {
      throw new Error("forbidden");
    }
    return { userId: "u1", role: "admin" as const };
  }),
}));

vi.mock("@/lib/db", () => {
  const db = {
    select: vi.fn(() => {
      const chain = {
        from: vi.fn(() => chain),
        innerJoin: vi.fn(() => chain),
        where: vi.fn(async () => state.rowsQueue.shift() ?? []),
      };
      return chain;
    }),
  };
  return { db };
});

describe("getMonthEndCloseReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.financeAllowed = true;
    state.rowsQueue = [];
  });

  it("returns pass/fail checks and totals from journal + operational data", async () => {
    state.rowsQueue = [
      [{ sum: 1000 }],
      [{ sum: 400 }],
      [{ sum: 1000 }],
      [{ sum: 500 }],
      [{ count: 3 }],
    ];

    const { getMonthEndCloseReport } = await import("@/actions/month-end-close-actions");
    const result = await getMonthEndCloseReport({ year: 2026, month: 0 });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.month).toBe("January 2026");
    expect(result.data.totalIncome).toBe(1000);
    expect(result.data.totalExpense).toBe(400);
    expect(result.data.netProfit).toBe(600);
    expect(result.data.projectCount).toBe(3);
    expect(result.data.allPassed).toBe(false);
    expect(result.data.checks[0]?.status).toBe("pass");
    expect(result.data.checks[1]?.status).toBe("fail");
    expect(result.data.paymentCount).toBe(1);
    expect(result.data.costCount).toBe(1);
  });

  it("returns action error when input is invalid", async () => {
    const { getMonthEndCloseReport } = await import("@/actions/month-end-close-actions");
    const result = await getMonthEndCloseReport({ year: 2026, month: 99 });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain("expected number to be <=11");
  });

  it("returns action error when access is denied", async () => {
    state.financeAllowed = false;

    const { getMonthEndCloseReport } = await import("@/actions/month-end-close-actions");
    const result = await getMonthEndCloseReport({ year: 2026, month: 1 });

    expect(result.success).toBe(false);
  });
});
