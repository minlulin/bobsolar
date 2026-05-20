import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  auth: { userId: "u1", role: "staff" as "admin" | "staff" },
  project: {
    id: "11111111-1111-4111-8111-111111111111",
    status: "planning",
    projectNumber: "PJ-2026-0001",
    siteAddress: "site",
    systemSizeKwp: "5",
    quotedTotal: "1000",
    startDate: null,
    // biome-ignore lint/suspicious/noExplicitAny: test mock state
  } as any,
  inventoryItem: {
    id: "33333333-3333-4333-8333-333333333333",
    stockQty: 1,
    isActive: true,
    unitPrice: "100",
    name: "Panel",
    // biome-ignore lint/suspicious/noExplicitAny: test mock state
  } as any,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/validate", () => ({
  requireAuth: vi.fn(async () => state.auth),
  requireAdmin: vi.fn(async () => ({ userId: "u1", role: "admin" as const })),
  requireFinanceAccess: vi.fn(async () => ({ userId: "u1", role: "admin" as const })),
}));
vi.mock("@/lib/notifications/broadcast", () => ({
  notifyAllUsers: vi.fn(async () => undefined),
  notifyAdminUsers: vi.fn(async () => undefined),
}));
vi.mock("@/lib/finance/ledger", () => ({
  assertFinanceSsotDrift: vi.fn(),
  assertJournalEntryNotReversed: vi.fn(),
  createBalancedJournalEntry: vi.fn(async () => ({ entryId: "je1" })),
  mapCostTypeToExpenseAccount: vi.fn(() => "misc_expense"),
  mapPaymentMethodNameToAssetAccount: vi.fn(() => "cash_on_hand"),
  reverseJournalEntry: vi.fn(async () => ({ entryId: "je2" })),
}));
vi.mock("@/lib/db", () => {
  const db = {
    query: {
      projects: { findFirst: vi.fn(async () => state.project) },
      inventoryItems: { findFirst: vi.fn(async () => state.inventoryItem) },
      paymentMethods: { findFirst: vi.fn(async () => ({ id: "pm", name: "cash" })) },
      projectCosts: { findMany: vi.fn(async () => []) },
      journalEntries: { findFirst: vi.fn(async () => null) },
    },
    // biome-ignore lint/suspicious/noExplicitAny: drizzle transaction mock
    transaction: vi.fn(async (cb: any) => {
      const tx = {
        query: {
          inventoryItems: { findFirst: vi.fn(async () => state.inventoryItem) },
          paymentMethods: { findFirst: vi.fn(async () => ({ id: "pm", name: "cash" })) },
          journalEntries: { findFirst: vi.fn(async () => null) },
        },
        update: vi.fn(() => ({
          set: vi.fn(() => ({ where: vi.fn(async () => []) })),
          returning: vi.fn(async () => [{ id: state.project.id }]),
        })),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn(async () => [{ id: "cost1" }]) })),
        })),
        select: vi.fn(() => ({
          from: vi.fn(() => ({ where: vi.fn(async () => [{ total: "100" }]) })),
        })),
        delete: vi.fn(() => ({ where: vi.fn(async () => undefined) })),
      };
      return cb(tx);
    }),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) })),
  };
  return { db };
});

describe("project-actions guardrails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.auth = { userId: "u1", role: "staff" };
    state.project = {
      id: "11111111-1111-4111-8111-111111111111",
      status: "planning",
      projectNumber: "PJ-2026-0001",
      siteAddress: "site",
      systemSizeKwp: "5",
      quotedTotal: "1000",
      startDate: null,
      // biome-ignore lint/suspicious/noExplicitAny: test mock state
    } as any;
    state.inventoryItem = {
      id: "33333333-3333-4333-8333-333333333333",
      stockQty: 1,
      isActive: true,
      unitPrice: "100",
      name: "Panel",
      // biome-ignore lint/suspicious/noExplicitAny: test mock state
    } as any;
  });

  it("blocks non-admin status change", async () => {
    const { updateProject } = await import("@/actions/project-actions");
    const res = await updateProject({
      id: state.project.id,
      status: "in_progress",
    });
    expect(res.success).toBe(false);
  });

  it("blocks inventory over-consumption", async () => {
    const { consumeProjectInventory } = await import("@/actions/project-actions");
    const res = await consumeProjectInventory({
      projectId: state.project.id,
      inventoryItemId: state.inventoryItem.id,
      paymentMethodId: "44444444-4444-4444-8444-444444444444",
      quantity: 5,
      description: "consume",
      incurredDate: new Date(),
    });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("Insufficient stock");
  });

  it("markProjectCompleted rejects already completed", async () => {
    state.project = { ...state.project, status: "completed" };
    const { markProjectCompleted } = await import("@/actions/project-actions");
    const res = await markProjectCompleted(state.project.id);
    expect(res.success).toBe(false);
  });
});
