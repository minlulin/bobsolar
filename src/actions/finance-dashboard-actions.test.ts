import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  financeFail: false,
  queue: [] as unknown[],
}));

class QueryBuilder {
  where(): QueryBuilder {
    return this;
  }
  from(): QueryBuilder {
    return this;
  }
  innerJoin(): QueryBuilder {
    return this;
  }
  leftJoin(): QueryBuilder {
    return this;
  }
  groupBy(): QueryBuilder {
    return this;
  }
  orderBy(): QueryBuilder {
    return this;
  }
  as(): QueryBuilder {
    return this;
  }
  // biome-ignore lint/suspicious/noThenProperty: intentional thenable mock for drizzle query builder
  then(resolve: (value: unknown) => unknown): Promise<unknown> {
    const next = state.queue.shift() ?? [];
    return Promise.resolve(resolve(next));
  }
}

const metricsSpies = vi.hoisted(() => ({
  latency: vi.fn(),
  failure: vi.fn(),
}));

vi.mock("@/lib/auth/validate", () => ({
  requireOwner: vi.fn(async () => {
    if (state.financeFail) throw new Error("Unauthorized");
    return { userId: "u1", role: "admin" as const };
  }),
}));

vi.mock("@/lib/finance/metrics", () => ({
  recordFinanceDashboardLatency: metricsSpies.latency,
  recordJournalPostFailure: metricsSpies.failure,
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => new QueryBuilder()),
  },
}));

vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...args: unknown[]) => Promise<unknown>) => fn,
}));

describe("finance-dashboard-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.financeFail = false;
    state.queue = [];
  });

  it("returns finance summary", async () => {
    state.queue = [
      [{ sum: 200000 }],
      [{ sum: 120000 }],
      [{ amount: 50000 }],
      [
        { accountCode: "cash_on_hand", balance: 10000 },
        { accountCode: "kbz_wallet", balance: 3000 },
        { accountCode: "aya_wallet", balance: 2000 },
        { accountCode: "cb_wallet", balance: 0 },
        { accountCode: "wave_wallet", balance: 0 },
        { accountCode: "kbz_banking", balance: 5000 },
        { accountCode: "aya_banking", balance: 2000 },
        { accountCode: "cb_banking", balance: 1000 },
      ],
      [{ sum: 40000 }],
    ];

    const { getFinanceSummary } = await import("@/actions/finance-dashboard-actions");
    const res = await getFinanceSummary({});
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.totalIncome).toBe(200000);
    expect(res.data.totalCogs).toBe(40000);
    expect(res.data.netProfit).toBe(40000);
    expect(res.data.walletBalance).toBe(5000);
    expect(res.data.bankBalance).toBe(8000);
  });

  it("returns monthly trend", async () => {
    state.queue = [
      [{ month: "2026-05", amount: "100000" }],
      [{ month: "2026-05", amount: "40000" }],
    ];

    const { getMonthlyTrend } = await import("@/actions/finance-dashboard-actions");
    const res = await getMonthlyTrend({ dateFrom: "2026-05-01", dateTo: "2026-05-31" });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data).toHaveLength(1);
    expect(res.data[0]?.income).toBe(100000);
    expect(res.data[0]?.expense).toBe(40000);
  });

  it("returns expense breakdown", async () => {
    state.queue = [
      [
        { accountCode: "material_expense", amount: "70000" },
        { accountCode: "labor_expense", amount: "30000" },
      ],
    ];

    const { getExpenseBreakdown } = await import("@/actions/finance-dashboard-actions");
    const res = await getExpenseBreakdown({});
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data[0]?.label).toBe("Materials");
    expect(res.data[0]?.percentage).toBe(70);
  });

  it("returns receivable risk data", async () => {
    state.queue = [
      [
        {
          invoiceId: "inv1",
          invoiceNumber: "INV-2026-0001",
          projectId: "p1",
          projectNumber: "PJ-2026-0001",
          customerName: "Ko",
          totalAmount: "300000",
          paidAmount: "100000",
          balanceDue: "200000",
          dueDate: new Date("2026-04-01"),
          status: "unpaid",
        },
      ],
    ];

    const { getReceivableRiskData } = await import("@/actions/finance-dashboard-actions");
    const res = await getReceivableRiskData();
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data[0]?.outstanding).toBe(200000);
  });

  it("returns consistency check", async () => {
    state.queue = [[{ sum: 90000 }], [{ sum: 90000 }], [{ sum: 50000 }], [{ sum: 45000 }]];

    const { getDataConsistencyCheck } = await import("@/actions/finance-dashboard-actions");
    const res = await getDataConsistencyCheck();
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.incomeMatch).toBe(true);
    expect(res.data.expenseMatch).toBe(false);
  });

  it("does not record journal failure metric on auth errors", async () => {
    state.financeFail = true;
    const { getFinanceSummary } = await import("@/actions/finance-dashboard-actions");
    const res = await getFinanceSummary({});
    expect(res.success).toBe(false);
    expect(metricsSpies.failure).not.toHaveBeenCalled();
  });

  it("does not fail summary when latency metric recording throws", async () => {
    state.queue = [
      [{ sum: 200000 }],
      [{ sum: 120000 }],
      [{ amount: 50000 }],
      [
        { accountCode: "cash_on_hand", balance: 10000 },
        { accountCode: "kbz_wallet", balance: 3000 },
        { accountCode: "aya_wallet", balance: 2000 },
        { accountCode: "cb_wallet", balance: 0 },
        { accountCode: "wave_wallet", balance: 0 },
        { accountCode: "kbz_banking", balance: 5000 },
        { accountCode: "aya_banking", balance: 2000 },
        { accountCode: "cb_banking", balance: 1000 },
      ],
      [{ sum: 40000 }],
    ];
    metricsSpies.latency.mockImplementationOnce(() => {
      throw new Error("metric sink down");
    });

    const { getFinanceSummary } = await import("@/actions/finance-dashboard-actions");
    const res = await getFinanceSummary({});
    expect(res.success).toBe(true);
  });
});
