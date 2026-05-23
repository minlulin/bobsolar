import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  auth: { userId: "00000000-0000-4000-8000-000000000001", role: "admin" as "admin" | "staff" },
  projectStatus: "installation_completed" as
    | "planning"
    | "in_progress"
    | "on_hold"
    | "installation_completed"
    | "completed"
    | "cancelled",
  quotedTotal: "100000",
  estimatedCogs: "15000",
  receivedTotal: "50000",
  updateReturningCount: 1,
  txCostSum: "0",
  inventoryItem: {
    id: "44444444-4444-4444-8444-444444444444",
    name: "Panel X",
    isActive: true,
    stockQty: 1,
    unitPrice: "120000",
  } as null | { id: string; name: string; isActive: boolean; stockQty: number; unitPrice: string },
  dbUpdateCalled: false,
  revalidateCalls: [] as string[],
  queryProjectCall: 0,
  projectDetailRow: {
    id: "11111111-1111-4111-8111-111111111111",
    projectNumber: "PJ-2026-0001",
    status: "in_progress",
    quotedTotal: "100000",
    startDate: null,
    siteAddress: "Site",
    systemSizeKwp: "10",
    targetCompletion: null,
    notes: null,
    customer: {
      id: "c1",
      name: "Customer",
      email: null,
      phone: "09123",
      address: null,
      city: null,
      notes: null,
      isArchived: false,
      archivedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    quotation: null,
    costs: [
      {
        id: "cost-1",
        projectId: "11111111-1111-4111-8111-111111111111",
        itemId: "44444444-4444-4444-8444-444444444444",
        description: "Material",
        amount: "20000",
        costType: "material",
        incurredDate: new Date(),
        inventoryItem: { id: "44444444-4444-4444-8444-444444444444", name: "Panel X" },
        addedBy: { id: "00000000-0000-4000-8000-000000000001", name: "Admin" },
      },
      {
        id: "cost-2",
        projectId: "11111111-1111-4111-8111-111111111111",
        itemId: null,
        description: "Labor",
        amount: "10000",
        costType: "labor",
        incurredDate: new Date(),
        inventoryItem: null,
        addedBy: { id: "00000000-0000-4000-8000-000000000001", name: "Admin" },
      },
    ],
    remarks: [],
    warrantyAlerts: [],
  } as Record<string, unknown> | null,
  remarkRow: {
    id: "r1",
    projectId: "11111111-1111-4111-8111-111111111111",
    authorId: "other-user",
  } as null | { id: string; projectId: string; authorId: string },
  costRow: {
    id: "cost-1",
    projectId: "11111111-1111-4111-8111-111111111111",
  } as null | { id: string; projectId: string },
}));

const spies = vi.hoisted(() => ({
  revalidatePath: vi.fn((path: string) => {
    state.revalidateCalls.push(path);
  }),
  notifyAllUsers: vi.fn(async () => undefined),
  notifyAdminUsers: vi.fn(async () => undefined),
  createBalancedJournalEntry: vi.fn(async () => undefined),
}));

function makeProject(status = state.projectStatus): {
  id: string;
  projectNumber: string;
  status:
    | "planning"
    | "in_progress"
    | "on_hold"
    | "installation_completed"
    | "completed"
    | "cancelled";
  quotedTotal: string;
  estimatedCogs: string;
  startDate: Date | null;
  siteAddress: string;
  systemSizeKwp: string;
  targetCompletion: Date | null;
  notes: string | null;
} {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    projectNumber: "PJ-2026-0001",
    status,
    quotedTotal: state.quotedTotal,
    estimatedCogs: state.estimatedCogs,
    startDate: null,
    siteAddress: "Site",
    systemSizeKwp: "10",
    targetCompletion: null,
    notes: null,
  };
}

vi.mock("next/cache", () => ({
  revalidatePath: spies.revalidatePath,
}));

vi.mock("@/lib/auth/validate", () => ({
  requireAuth: vi.fn(async () => state.auth),
  requireAdmin: vi.fn(async () => ({ userId: state.auth.userId, role: "admin" as const })),
  requireFinanceAccess: vi.fn(async () => ({ userId: state.auth.userId, role: "admin" as const })),
}));

vi.mock("@/lib/notifications/broadcast", () => ({
  notifyAllUsers: spies.notifyAllUsers,
  notifyAdminUsers: spies.notifyAdminUsers,
}));

vi.mock("@/lib/finance/ledger", () => ({
  assertFinanceSsotDrift: vi.fn(),
  assertJournalEntryNotReversed: vi.fn(async () => undefined),
  createBalancedJournalEntry: spies.createBalancedJournalEntry,
  mapCostTypeToExpenseAccount: vi.fn(() => "material_expense"),
  mapPaymentMethodNameToAssetAccount: vi.fn(() => "cash"),
  reverseJournalEntry: vi.fn(async () => undefined),
}));

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      projects: {
        findFirst: vi.fn(async (args?: { columns?: { quotedTotal?: boolean }; with?: unknown }) => {
          state.queryProjectCall += 1;
          if (args?.with) return state.projectDetailRow;
          if (args?.columns?.quotedTotal) {
            return { quotedTotal: state.quotedTotal };
          }
          if (state.queryProjectCall > 1 && state.projectStatus === "installation_completed") {
            return makeProject("completed");
          }
          return makeProject(state.projectStatus);
        }),
      },
      projectCosts: {
        findMany: vi.fn(async () => []),
        findFirst: vi.fn(async () => state.costRow),
      },
      projectRemarks: {
        findFirst: vi.fn(async () => state.remarkRow),
        findMany: vi.fn(async () => []),
      },
      warrantyAlerts: {
        findMany: vi.fn(async () => []),
      },
    },
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => [{ total: state.receivedTotal }]),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(async () => {
          state.dbUpdateCalled = true;
          return [];
        }),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(async () => undefined),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(async () => undefined),
    })),
    transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        query: {
          inventoryItems: {
            findFirst: vi.fn(async () => state.inventoryItem),
          },
          paymentMethods: {
            findFirst: vi.fn(async () => ({ id: "pm-1", name: "AYA Pay" })),
          },
          journalEntries: {
            findFirst: vi.fn(async () => null),
          },
        },
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn(() => ({
              returning: vi.fn(async () =>
                state.updateReturningCount > 0
                  ? [{ id: "11111111-1111-4111-8111-111111111111" }]
                  : [],
              ),
            })),
          })),
        })),
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(async () => [{ total: state.txCostSum }]),
          })),
        })),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            returning: vi.fn(async () => [{ id: "cost-1" }]),
          })),
        })),
        delete: vi.fn(() => ({ where: vi.fn(async () => undefined) })),
      };
      return await fn(tx);
    }),
  },
}));

describe("project-actions high-impact branches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.auth = { userId: "00000000-0000-4000-8000-000000000001", role: "admin" };
    state.projectStatus = "installation_completed";
    state.quotedTotal = "100000";
    state.estimatedCogs = "15000";
    state.receivedTotal = "50000";
    state.updateReturningCount = 1;
    state.txCostSum = "0";
    state.inventoryItem = {
      id: "44444444-4444-4444-8444-444444444444",
      name: "Panel X",
      isActive: true,
      stockQty: 1,
      unitPrice: "120000",
    };
    state.dbUpdateCalled = false;
    state.revalidateCalls = [];
    state.queryProjectCall = 0;
    state.projectDetailRow = {
      ...makeProject("in_progress"),
      customer: {
        id: "c1",
        name: "Customer",
        email: null,
        phone: "09123",
        address: null,
        city: null,
        notes: null,
        isArchived: false,
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      quotation: null,
      costs: [],
      remarks: [],
      warrantyAlerts: [],
    };
    state.remarkRow = {
      id: "r1",
      projectId: "11111111-1111-4111-8111-111111111111",
      authorId: "other-user",
    };
    state.costRow = {
      id: "cost-1",
      projectId: "11111111-1111-4111-8111-111111111111",
    };
  });

  it("completes project even when receivable is outstanding", async () => {
    state.projectStatus = "installation_completed";
    state.receivedTotal = "50000";

    const { markProjectCompleted } = await import("@/actions/project-actions");
    const res = await markProjectCompleted("11111111-1111-4111-8111-111111111111");

    expect(res.success).toBe(true);
  });

  it("blocks completion from invalid status transition", async () => {
    state.projectStatus = "in_progress";
    state.receivedTotal = "100000";

    const { markProjectCompleted } = await import("@/actions/project-actions");
    const res = await markProjectCompleted("11111111-1111-4111-8111-111111111111");

    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.error).toContain("Installation Completed state");
  });

  it("marks completed when settled and valid status", async () => {
    state.projectStatus = "installation_completed";
    state.receivedTotal = "100000";

    const { markProjectCompleted } = await import("@/actions/project-actions");
    const res = await markProjectCompleted("11111111-1111-4111-8111-111111111111");

    expect(res.success).toBe(true);
    expect(spies.notifyAllUsers).toHaveBeenCalled();
    expect(state.revalidateCalls).toContain("/projects/completed");
  });

  it("blocks add cost after installation completion", async () => {
    state.projectStatus = "installation_completed";

    const { addProjectCost } = await import("@/actions/project-actions");
    const res = await addProjectCost({
      projectId: "11111111-1111-4111-8111-111111111111",
      paymentMethodId: "22222222-2222-4222-8222-222222222222",
      description: "Material",
      amount: 10000,
      costType: "material",
      incurredDate: new Date("2026-05-20"),
    });

    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.error).toContain("Cannot add costs after installation completion");
  });

  it("maps insufficient stock for consume inventory", async () => {
    state.projectStatus = "in_progress";
    state.inventoryItem = {
      id: "44444444-4444-4444-8444-444444444444",
      name: "Panel X",
      isActive: true,
      stockQty: 0,
      unitPrice: "120000",
    };

    const { consumeProjectInventory } = await import("@/actions/project-actions");
    const res = await consumeProjectInventory({
      projectId: "11111111-1111-4111-8111-111111111111",
      inventoryItemId: "44444444-4444-4444-8444-444444444444",
      paymentMethodId: "22222222-2222-4222-8222-222222222222",
      quantity: 1,
      description: "Consume one panel",
      incurredDate: new Date("2026-05-20"),
    });

    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.error).toContain("Insufficient stock");
  });

  it("blocks status change in updateProject for non-admin", async () => {
    state.auth = { userId: "00000000-0000-4000-8000-000000000001", role: "staff" };
    state.projectStatus = "planning";

    const { updateProject } = await import("@/actions/project-actions");
    const res = await updateProject({
      id: "11111111-1111-4111-8111-111111111111",
      status: "in_progress",
    });

    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.error).toContain("Only admins can change project status");
  });

  it("updates project notes without status transition", async () => {
    state.auth = { userId: "00000000-0000-4000-8000-000000000001", role: "admin" };

    const { updateProject } = await import("@/actions/project-actions");
    const res = await updateProject({
      id: "11111111-1111-4111-8111-111111111111",
      notes: "Updated note",
    });

    expect(res.success).toBe(true);
    expect(state.dbUpdateCalled).toBe(true);
    expect(state.revalidateCalls).toContain("/projects");
  });

  it("adds project cost on active project", async () => {
    state.projectStatus = "in_progress";
    const { addProjectCost } = await import("@/actions/project-actions");
    const res = await addProjectCost({
      projectId: "11111111-1111-4111-8111-111111111111",
      paymentMethodId: "22222222-2222-4222-8222-222222222222",
      description: "Material",
      amount: 10000,
      costType: "material",
      incurredDate: new Date("2026-05-20"),
    });
    expect(res.success).toBe(true);
    expect(spies.createBalancedJournalEntry).toHaveBeenCalled();
  });

  it("maps inventory_not_found in consume flow", async () => {
    state.projectStatus = "in_progress";
    state.inventoryItem = null;
    const { consumeProjectInventory } = await import("@/actions/project-actions");
    const res = await consumeProjectInventory({
      projectId: "11111111-1111-4111-8111-111111111111",
      inventoryItemId: "44444444-4444-4444-8444-444444444444",
      paymentMethodId: "22222222-2222-4222-8222-222222222222",
      quantity: 1,
      description: "Consume",
      incurredDate: new Date("2026-05-20"),
    });
    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.error).toContain("Inventory item not found");
  });

  it("maps inventory_inactive in consume flow", async () => {
    state.projectStatus = "in_progress";
    state.inventoryItem = {
      id: "44444444-4444-4444-8444-444444444444",
      name: "Panel X",
      isActive: false,
      stockQty: 5,
      unitPrice: "120000",
    };
    const { consumeProjectInventory } = await import("@/actions/project-actions");
    const res = await consumeProjectInventory({
      projectId: "11111111-1111-4111-8111-111111111111",
      inventoryItemId: "44444444-4444-4444-8444-444444444444",
      paymentMethodId: "22222222-2222-4222-8222-222222222222",
      quantity: 1,
      description: "Consume",
      incurredDate: new Date("2026-05-20"),
    });
    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.error).toContain("inactive");
  });

  it("deletes project cost when record exists", async () => {
    const { deleteProjectCost } = await import("@/actions/project-actions");
    const res = await deleteProjectCost("11111111-1111-4111-8111-111111111111");
    expect(res.success).toBe(true);
  });

  it("blocks deleting other user remark for staff", async () => {
    state.auth = { userId: "00000000-0000-4000-8000-000000000001", role: "staff" };
    state.remarkRow = {
      id: "r1",
      projectId: "11111111-1111-4111-8111-111111111111",
      authorId: "another-user",
    };
    const { deleteProjectRemark } = await import("@/actions/project-actions");
    const res = await deleteProjectRemark("11111111-1111-4111-8111-111111111111");
    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.error).toContain("only delete your own");
  });

  it("returns project detail with profitability", async () => {
    state.receivedTotal = "25000";
    state.projectDetailRow = {
      ...makeProject("in_progress"),
      customer: {
        id: "c1",
        name: "Customer",
        email: null,
        phone: "09123",
        address: null,
        city: null,
        notes: null,
        isArchived: false,
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      quotation: null,
      costs: [
        {
          id: "cost-1",
          projectId: "11111111-1111-4111-8111-111111111111",
          itemId: "44444444-4444-4444-8444-444444444444",
          description: "Material",
          amount: "20000",
          costType: "material",
          incurredDate: new Date(),
          addedBy: { id: "u1", name: "Admin" },
          inventoryItem: { id: "44444444-4444-4444-8444-444444444444", name: "Panel X" },
        },
        {
          id: "cost-2",
          projectId: "11111111-1111-4111-8111-111111111111",
          itemId: null,
          description: "Labor",
          amount: "10000",
          costType: "labor",
          incurredDate: new Date(),
          addedBy: { id: "u1", name: "Admin" },
          inventoryItem: null,
        },
      ],
      remarks: [],
      warrantyAlerts: [],
    };
    const { getProject } = await import("@/actions/project-actions");
    const res = await getProject("11111111-1111-4111-8111-111111111111");
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.profitability.receivedPayment).toBe(25000);
    expect(res.data.profitability.inventoryConsumedCost).toBe(20000);
    expect(res.data.profitability.additionalCosts).toBe(10000);
    expect(res.data.profitability.grossProfit).toBe(80000);
    expect(res.data.profitability.netProfit).toBe(70000);
  });
});
