import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  authFails: false,
  selectMode: "ok" as "ok" | "throw",
}));

vi.mock("@/lib/auth/validate", () => ({
  requireFinanceAccess: vi.fn(async () => {
    if (state.authFails) throw new Error("auth fail");
    return { userId: "u1", role: "admin" as const };
  }),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => {
      if (state.selectMode === "throw") throw new Error("db fail");
      // biome-ignore lint/suspicious/noExplicitAny: drizzle query chain mock
      const chain: any = {
        from: vi.fn(() => chain),
        innerJoin: vi.fn(() => chain),
        where: vi.fn(() => chain),
        groupBy: vi.fn(() => chain),
        orderBy: vi.fn(async () => []),
      };
      return chain;
    }),
    query: {
      paymentMethods: {
        findMany: vi.fn(async () => []),
      },
    },
  },
}));

describe("payment-actions error branches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.authFails = false;
    state.selectMode = "ok";
  });

  it("getPaymentFinanceSummary handles auth failure", async () => {
    state.authFails = true;
    const { getPaymentFinanceSummary } = await import("@/actions/payment-actions");
    const res = await getPaymentFinanceSummary();
    expect(res.success).toBe(false);
  });

  it("getProjectPayments handles db failure", async () => {
    state.selectMode = "throw";
    const { getProjectPayments } = await import("@/actions/payment-actions");
    const res = await getProjectPayments("11111111-1111-4111-8111-111111111111");
    expect(res.success).toBe(false);
  });

  it("getPaymentMethods success empty list", async () => {
    const { getPaymentMethods } = await import("@/actions/payment-actions");
    const res = await getPaymentMethods();
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data).toEqual([]);
  });
});
