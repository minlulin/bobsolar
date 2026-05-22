import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  auth: { userId: "u1", role: "admin" as const },
  quotation: {
    id: "11111111-1111-4111-8111-111111111111",
    status: "accepted",
    customerId: "22222222-2222-4222-8222-222222222222",
    total: "100000",
    customer: { address: "Addr", city: "Yangon" },
    project: null as null | { id: string },
    // biome-ignore lint/suspicious/noExplicitAny: test mock state
  } as any,
  // biome-ignore lint/suspicious/noExplicitAny: test mock state
  projectInsertRow: { id: "p1", projectNumber: "PJ-2026-0001" } as any,
  // biome-ignore lint/suspicious/noExplicitAny: test mock state
  projectsRows: [] as any[],
  // biome-ignore lint/suspicious/noExplicitAny: test mock state
  countsRows: [{ count: 0 }] as any[],
  // biome-ignore lint/suspicious/noExplicitAny: test mock state
  warrantyRows: [] as any[],
  // biome-ignore lint/suspicious/noExplicitAny: test mock state
  projectRow: { id: "p1", projectNumber: "PJ-2026-0001", status: "in_progress" } as any,
  // biome-ignore lint/suspicious/noExplicitAny: test mock state
  remarks: [] as any[],
  // biome-ignore lint/suspicious/noExplicitAny: test mock state
  alertRow: { id: "wa1", projectId: "p1", description: "Check" } as any,
  selectCall: 0,
}));

const spies = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  notifyAllUsers: vi.fn(async () => undefined),
}));

vi.mock("next/cache", () => ({ revalidatePath: spies.revalidatePath }));
vi.mock("@/lib/auth/validate", () => ({
  requireAuth: vi.fn(async () => state.auth),
  requireAdmin: vi.fn(async () => state.auth),
  requireFinanceAccess: vi.fn(async () => state.auth),
}));
vi.mock("@/lib/notifications/broadcast", () => ({
  notifyAllUsers: spies.notifyAllUsers,
  notifyAdminUsers: vi.fn(async () => undefined),
}));
vi.mock("@/lib/finance/ledger", () => ({
  assertFinanceSsotDrift: vi.fn(),
  assertJournalEntryNotReversed: vi.fn(),
  createBalancedJournalEntry: vi.fn(async () => ({ entryId: "je1" })),
  mapCostTypeToExpenseAccount: vi.fn(() => "material_expense"),
  mapPaymentMethodNameToAssetAccount: vi.fn(() => "cash_on_hand"),
  reverseJournalEntry: vi.fn(async () => ({ entryId: "je2" })),
}));

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      quotations: {
        findFirst: vi.fn(async () => state.quotation),
      },
      projects: {
        findFirst: vi.fn(async () => state.projectRow),
      },
      warrantyAlerts: {
        findMany: vi.fn(async () => state.warrantyRows),
      },
      projectRemarks: {
        findMany: vi.fn(async () => state.remarks),
      },
    },
    select: vi.fn(() => {
      state.selectCall += 1;
      const call = state.selectCall;
      // biome-ignore lint/suspicious/noExplicitAny: drizzle query chain mock
      const chain: any = {
        from: vi.fn(() => chain),
        innerJoin: vi.fn(() => chain),
        leftJoin: vi.fn(() => chain),
        where: vi.fn(() => {
          if (call === 2) return Promise.resolve(state.countsRows);
          return chain;
        }),
        groupBy: vi.fn(() => chain),
        orderBy: vi.fn(() => chain),
        limit: vi.fn(() => chain),
        offset: vi.fn(async () => state.projectsRows),
      };
      return chain;
    }),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(async () => [state.alertRow]),
      })),
    })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) })),
    delete: vi.fn(() => ({ where: vi.fn(async () => undefined) })),
    // biome-ignore lint/suspicious/noExplicitAny: drizzle transaction mock
    transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => {
      const tx = {
        query: {
          quotations: {
            findFirst: vi.fn(async () => state.quotation),
          },
        },
        select: vi.fn(() => {
          // biome-ignore lint/suspicious/noExplicitAny: drizzle query chain mock
          const chain: any = {
            from: vi.fn(() => chain),
            where: vi.fn(async () => []),
          };
          return chain;
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn(async () => [state.projectInsertRow]) })),
        })),
      };
      return cb(tx);
    }),
  },
}));

describe("project-actions additional branches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.selectCall = 0;
    state.quotation = {
      id: "11111111-1111-4111-8111-111111111111",
      status: "accepted",
      customerId: "22222222-2222-4222-8222-222222222222",
      total: "100000",
      customer: { address: "Addr", city: "Yangon" },
      project: null,
    };
    state.projectInsertRow = { id: "p1", projectNumber: "PJ-2026-0001" };
    state.projectsRows = [];
    state.countsRows = [{ count: 0 }];
    state.warrantyRows = [];
    state.projectRow = { id: "p1", projectNumber: "PJ-2026-0001", status: "in_progress" };
    state.remarks = [];
  });

  it("convertQuotationToProject rejects non-accepted status", async () => {
    state.quotation.status = "draft";
    const { convertQuotationToProject } = await import("@/actions/project-actions");
    const res = await convertQuotationToProject({ quotationId: state.quotation.id });
    expect(res.success).toBe(false);
  });

  it("convertQuotationToProject rejects when already linked", async () => {
    state.quotation.project = { id: "p-existing" };
    const { convertQuotationToProject } = await import("@/actions/project-actions");
    const res = await convertQuotationToProject({ quotationId: state.quotation.id });
    expect(res.success).toBe(false);
  });

  it("convertQuotationToProject creates project on success", async () => {
    const { createBalancedJournalEntry } = await import("@/lib/finance/ledger");
    const { convertQuotationToProject } = await import("@/actions/project-actions");
    const res = await convertQuotationToProject({
      quotationId: state.quotation.id,
      systemSizeKwp: 5,
      notes: "n",
    });
    expect(res.success).toBe(true);
    expect(spies.revalidatePath).toHaveBeenCalledWith("/projects");
    expect(createBalancedJournalEntry).toHaveBeenCalled();
  });

  it("getProjects completed rollup computes warranty summary", async () => {
    state.projectsRows = [
      {
        project: {
          id: "p1",
          status: "completed",
          actualCompletion: new Date(),
          createdAt: new Date(),
        },
        customerName: "Cust",
        quoteNumber: "QT-1",
        costTotal: 123,
      },
    ];
    state.countsRows = [{ count: 1 }];
    state.warrantyRows = [
      { projectId: "p1", dueDate: new Date(Date.now() - 86_400_000), isResolved: false },
    ];

    const { getProjects } = await import("@/actions/project-actions");
    const res = await getProjects({ scope: "completed", page: 1, limit: 20 });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.items[0]?.warrantySummary).toBe("overdue");
  });

  it("addProjectRemark success", async () => {
    state.projectRow = { id: "p1", projectNumber: "PJ", status: "in_progress" };
    state.remarks = [{ id: "r1", projectId: "p1", content: "ok" }];

    const { addProjectRemark } = await import("@/actions/project-actions");
    const res = await addProjectRemark({
      projectId: "11111111-1111-4111-8111-111111111111",
      content: "hello",
      remarkType: "note",
    });
    expect(res.success).toBe(true);
  });

  it("createWarrantyAlertForProject success", async () => {
    state.projectRow = { id: "p1", projectNumber: "PJ-2026-0001", status: "completed" };
    const { createWarrantyAlertForProject } = await import("@/actions/project-actions");
    const res = await createWarrantyAlertForProject({
      projectId: "11111111-1111-4111-8111-111111111111",
      alertType: "maintenance_due",
      description: "service check",
      dueDate: new Date(),
    });
    expect(res.success).toBe(true);
    expect(spies.notifyAllUsers).toHaveBeenCalled();
  });
});
