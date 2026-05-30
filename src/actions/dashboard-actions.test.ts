import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";

const state = vi.hoisted(() => ({ authFail: false }));

// biome-ignore lint/suspicious/noExplicitAny: test mock query chain
function selectChain(result: unknown): any {
  // biome-ignore lint/suspicious/noExplicitAny: test mock query chain
  const chain: any = {
    from: () => chain,
    where: () => chain,
    limit: () => chain,
    orderBy: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    // biome-ignore lint/suspicious/noThenProperty: drizzle select is thenable
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve(result)),
  };
  return chain;
}

vi.mock("next/cache", () => ({ unstable_cache: vi.fn((fn: unknown) => fn) }));

vi.mock("@/lib/auth/validate", () => ({
  requireAuth: vi.fn(async () => {
    if (state.authFail) throw new Error("Unauthorized");
    return { userId: "u1", role: "admin" as const };
  }),
}));

vi.mock("@/lib/db", () => ({ db: { select: vi.fn(() => selectChain([])) } }));

describe("dashboard-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.authFail = false;
  });

  it("computes dashboard stats", async () => {
    vi.mocked(db.select)
      .mockImplementationOnce(() => selectChain([{ name: "Admin" }]) as never)
      .mockImplementationOnce(
        () =>
          selectChain([
            {
              totalRevenue: "200000",
              activeProjects: 3,
              thisMonthRevenue: "120000",
              prevMonthRevenue: "60000",
            },
          ]) as never,
      )
      .mockImplementationOnce(
        () =>
          selectChain([
            {
              pendingQuotes: 4,
              acceptedThisMonth: 2,
              acceptedTotal: 6,
              sentTotal: 2,
              rejectedTotal: 1,
              expiredTotal: 1,
            },
          ]) as never,
      )
      .mockImplementationOnce(() => selectChain([{ total: 10 }]) as never)
      .mockImplementationOnce(() => selectChain([{ total: 2 }]) as never);

    const { getDashboardStats } = await import("@/actions/dashboard-actions");
    const res = await getDashboardStats();
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.userName).toBe("Admin");
    expect(res.data.totalCustomers).toBe(10);
  });

  it("builds dashboard pipeline", async () => {
    vi.mocked(db.select)
      .mockImplementationOnce(() => selectChain([{ total: 12 }]) as never)
      .mockImplementationOnce(
        () => selectChain([{ activeQuoteCount: 5, activeQuoteValue: "90000" }]) as never,
      )
      .mockImplementationOnce(
        () =>
          selectChain([
            {
              activeProjectCount: 3,
              activeProjectValue: "120000",
              completedCount: 2,
              completedValue: "80000",
            },
          ]) as never,
      );

    const { getDashboardPipeline } = await import("@/actions/dashboard-actions");
    const res = await getDashboardPipeline();
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.stages).toHaveLength(4);
  });

  it("returns recent activity", async () => {
    vi.mocked(db.select)
      .mockImplementationOnce(
        () =>
          selectChain([
            { id: "q1", quoteNumber: "QT-1", createdAt: new Date("2026-05-18") },
          ]) as never,
      )
      .mockImplementationOnce(
        () =>
          selectChain([
            {
              id: "p1",
              projectNumber: "PJ-1",
              status: "completed",
              createdAt: new Date("2026-05-19"),
            },
          ]) as never,
      )
      .mockImplementationOnce(
        () =>
          selectChain([{ id: "c1", name: "Ko Ko", createdAt: new Date("2026-05-17") }]) as never,
      )
      .mockImplementationOnce(
        () =>
          selectChain([
            {
              id: "a1",
              projectId: "p1",
              description: "Warranty",
              dueDate: new Date("2026-05-25"),
              createdAt: new Date("2026-05-20"),
            },
          ]) as never,
      );

    const { getRecentActivity } = await import("@/actions/dashboard-actions");
    const res = await getRecentActivity(5);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data[0]?.type).toBe("alert");
  });

  it("returns upcoming alerts", async () => {
    vi.mocked(db.select).mockImplementationOnce(
      () =>
        selectChain([
          {
            id: "a1",
            projectId: "p1",
            projectNumber: "PJ-1",
            description: "Soon",
            dueDate: new Date("2020-01-01"),
            alertType: "warranty_expiry",
          },
        ]) as never,
    );

    const { getUpcomingAlerts } = await import("@/actions/dashboard-actions");
    const res = await getUpcomingAlerts(5);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data[0]?.isOverdue).toBe(true);
  });

  it("returns finance quick view", async () => {
    vi.mocked(db.select)
      .mockImplementationOnce(
        () =>
          selectChain([
            {
              todayCashIn: "30000",
              todayCashOut: "10000",
              monthIncome: "120000",
              monthExpense: "50000",
            },
          ]) as never,
      )
      .mockImplementationOnce(
        () =>
          selectChain([
            {
              arCount: 2,
              arAmount: "40000",
            },
          ]) as never,
      );

    const { getFinanceQuickView } = await import("@/actions/dashboard-actions");
    const res = await getFinanceQuickView();
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.monthNetMovement).toBe(70000);
    expect(res.data.outstandingReceivableCount).toBe(2);
    expect(res.data.outstandingReceivableAmount).toBe(40000);
  });
});
