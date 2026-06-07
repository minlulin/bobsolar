import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  auth: { userId: "u1", role: "admin" as const },
  project: { id: "11111111-1111-4111-8111-111111111111", status: "in_progress" },
  method: { id: "22222222-2222-4222-8222-222222222222", name: "Cash" },
  // biome-ignore lint/suspicious/noExplicitAny: test mock state
  paymentRows: [] as Array<any>,
  // biome-ignore lint/suspicious/noExplicitAny: test mock state
  selectQueue: [] as Array<any>,
  createdPayment: {
    id: "pay-1",
    projectId: "11111111-1111-4111-8111-111111111111",
    amount: "1000",
  },
}));

const spies = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  createBalancedJournalEntry: vi.fn(async () => ({ entryId: "je1" })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: spies.revalidatePath,
  revalidateTag: spies.revalidateTag,
}));
vi.mock("@/lib/auth/validate", () => ({
  requireAuth: vi.fn(async () => state.auth),
  requireOwner: vi.fn(async () => state.auth),
}));
vi.mock("@/lib/finance/ledger", () => ({
  assertFinanceSsotDrift: vi.fn(),
  createBalancedJournalEntry: spies.createBalancedJournalEntry,
  mapPaymentMethodNameToAssetAccount: vi.fn((name: string) =>
    name === "Cash" ? "cash_on_hand" : null,
  ),
}));

vi.mock("@/lib/db", () => {
  const db = {
    query: {
      projects: { findFirst: vi.fn(async () => state.project) },
      paymentMethods: {
        findFirst: vi.fn(async () => state.method),
        findMany: vi.fn(async () => [{ id: "m1", name: "Cash", isActive: true }]),
      },
    },
    // biome-ignore lint/suspicious/noExplicitAny: drizzle transaction mock
    transaction: vi.fn(async (cb: any) => {
      const tx = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              innerJoin: vi.fn(() => ({
                where: vi.fn(async () => [{ balance: "2000" }]),
              })),
            })),
          })),
        })),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            returning: vi.fn(async () => [state.createdPayment]),
          })),
        })),
        query: {
          projectPayments: {
            findFirst: vi.fn(async () => null), // No existing payment (no duplicate)
          },
        },
      };
      return cb(tx);
    }),
    select: vi.fn(() => {
      const chain = {
        from: vi.fn(() => chain),
        innerJoin: vi.fn(() => chain),
        where: vi.fn(() => chain),
        groupBy: vi.fn(() => chain),
        orderBy: vi.fn(async () => state.selectQueue.shift() ?? state.paymentRows),
      };
      return chain;
    }),
  };
  return { db };
});

describe("payment-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.project = { id: "11111111-1111-4111-8111-111111111111", status: "in_progress" };
    state.method = { id: "22222222-2222-4222-8222-222222222222", name: "Cash" };
    state.paymentRows = [];
    state.selectQueue = [];
  });

  it("records payment and posts journal", async () => {
    const { recordPayment } = await import("@/actions/payment-actions");
    const res = await recordPayment({
      projectId: state.project.id,
      amount: 1000,
      paymentMethodId: state.method.id,
      paymentDate: new Date(),
      paymentType: "final",
      reference: "r1",
      notes: "paid",
    });
    expect(res.success).toBe(true);
    expect(spies.createBalancedJournalEntry).toHaveBeenCalled();
    expect(spies.revalidatePath).toHaveBeenCalled();
  });

  it("rejects unsupported method mapping", async () => {
    state.method = { id: state.method.id, name: "cheque" };
    const { recordPayment } = await import("@/actions/payment-actions");
    const res = await recordPayment({
      projectId: state.project.id,
      amount: 1000,
      paymentMethodId: state.method.id,
      paymentDate: new Date(),
      paymentType: "advance",
    });
    expect(res.success).toBe(false);
  });

  it("builds finance summary from journal rows", async () => {
    state.paymentRows = [
      { entryDate: new Date(), sourceType: "project_payment", debit: "1200", credit: "0" },
      { entryDate: new Date(), sourceType: "project_expense", debit: "200", credit: "0" },
    ];
    state.paymentRows = [
      {
        payment: { id: "p1", projectId: state.project.id, amount: "1000" },
        methodName: "Cash",
      },
    ];
    const { getProjectPayments, getPaymentMethods } = await import("@/actions/payment-actions");
    const res = await getProjectPayments(state.project.id);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data[0]?.paymentMethodName).toBe("Cash");
    }
    const methods = await getPaymentMethods();
    expect(methods.success).toBe(true);
  });
});
