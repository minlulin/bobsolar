import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  auth: { userId: "u1", role: "admin" as const },
  projectExists: true,
  methodName: "cash",
  createdPayment: {
    id: "pay-1",
    projectId: "11111111-1111-4111-8111-111111111111",
    amount: "1000",
    // biome-ignore lint/suspicious/noExplicitAny: test mock state
  } as any,
}));

const spies = vi.hoisted(() => ({
  createBalancedJournalEntry: vi.fn(async () => ({ entryId: "je1" })),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: spies.revalidatePath }));
vi.mock("@/lib/auth/validate", () => ({ requireAuth: vi.fn(async () => state.auth) }));
vi.mock("@/lib/finance/ledger", () => ({
  assertFinanceSsotDrift: vi.fn(),
  createBalancedJournalEntry: spies.createBalancedJournalEntry,
  mapPaymentMethodNameToAssetAccount: vi.fn((name: string) =>
    name === "cash" ? "cash_on_hand" : null,
  ),
}));
vi.mock("@/lib/db", () => ({
  db: {
    query: {
      projects: { findFirst: vi.fn(async () => (state.projectExists ? { id: "p1" } : null)) },
      paymentMethods: {
        findFirst: vi.fn(async () =>
          state.methodName ? { id: "pm1", name: state.methodName } : null,
        ),
      },
    },
    // biome-ignore lint/suspicious/noExplicitAny: drizzle transaction mock
    transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => {
      const tx = {
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn(async () => [state.createdPayment]) })),
        })),
      };
      return cb(tx);
    }),
  },
}));

describe("recordPayment branches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.projectExists = true;
    state.methodName = "cash";
    state.createdPayment = {
      id: "pay-1",
      projectId: "11111111-1111-4111-8111-111111111111",
      amount: "1000",
    };
  });

  it("returns not found when project missing", async () => {
    state.projectExists = false;
    const { recordPayment } = await import("@/actions/payment-actions");
    const res = await recordPayment({
      projectId: "11111111-1111-4111-8111-111111111111",
      amount: 1000,
      paymentMethodId: "22222222-2222-4222-8222-222222222222",
      paymentDate: new Date(),
      paymentType: "advance",
    });
    expect(res.success).toBe(false);
  });

  it("returns state error when method mapping unsupported", async () => {
    state.methodName = "cheque";
    const { recordPayment } = await import("@/actions/payment-actions");
    const res = await recordPayment({
      projectId: "11111111-1111-4111-8111-111111111111",
      amount: 1000,
      paymentMethodId: "22222222-2222-4222-8222-222222222222",
      paymentDate: new Date(),
      paymentType: "final",
    });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("Unsupported payment method");
  });

  it("records payment success path", async () => {
    const { recordPayment } = await import("@/actions/payment-actions");
    const res = await recordPayment({
      projectId: "11111111-1111-4111-8111-111111111111",
      amount: 1000,
      paymentMethodId: "22222222-2222-4222-8222-222222222222",
      paymentDate: new Date(),
      paymentType: "final",
      notes: "received",
    });
    expect(res.success).toBe(true);
    expect(spies.createBalancedJournalEntry).toHaveBeenCalled();
    expect(spies.revalidatePath).toHaveBeenCalled();
  });
});
