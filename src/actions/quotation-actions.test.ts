import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  auth: { userId: "00000000-0000-4000-8000-000000000001", role: "admin" as "admin" | "staff" },
  quote: {
    id: "11111111-1111-4111-8111-111111111111",
    status: "sent",
    quoteNumber: "QT-2026-0001",
    createdBy: "00000000-0000-4000-8000-000000000001",
  } as null | {
    id: string;
    status: "draft" | "sent" | "accepted" | "rejected" | "expired";
    quoteNumber: string;
    createdBy: string;
  },
  linkedProject: null as null | { id: string },
  canTransition: true,
  updateCalled: false,
  deleteCalled: false,
  expireRows: [] as Array<{ id: string }>,
  quotationList: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      status: "draft",
      quoteNumber: "QT-2026-0001",
      createdBy: "00000000-0000-4000-8000-000000000001",
      customer: { name: "Customer" },
      createdByUser: { name: "Admin" },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ] as Array<Record<string, unknown>>,
  quotationCount: [{ total: 1 }],
  quotationDetail: {
    id: "11111111-1111-4111-8111-111111111111",
    status: "draft",
    quoteNumber: "QT-2026-0001",
    createdBy: "00000000-0000-4000-8000-000000000001",
    customerId: "c1",
    subtotal: "100000",
    discountPercent: "0",
    discountAmount: "0",
    taxPercent: "0",
    taxAmount: "0",
    total: "100000",
    notes: null,
    validUntil: null,
    isArchived: false,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [],
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
    project: null,
  } as Record<string, unknown> | null,
  txInsertedQuote: {
    id: "q2",
    status: "draft",
    quoteNumber: "QT-2026-0002",
    createdBy: "00000000-0000-4000-8000-000000000001",
  } as Record<string, unknown>,
}));

const spies = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  notifyAllUsers: vi.fn(async () => undefined),
}));

vi.mock("next/cache", () => ({
  revalidatePath: spies.revalidatePath,
  revalidateTag: spies.revalidateTag,
  unstable_cache: vi.fn((fn: unknown) => fn),
}));

vi.mock("@/lib/auth/validate", () => ({
  requireAuth: vi.fn(async () => state.auth),
  requireAdmin: vi.fn(async () => state.auth),
}));

vi.mock("@/lib/notifications/broadcast", () => ({
  notifyAllUsers: spies.notifyAllUsers,
}));

vi.mock("@/lib/validators/quotation", async () => {
  const actual = await vi.importActual<typeof import("@/lib/validators/quotation")>(
    "@/lib/validators/quotation",
  );
  return {
    ...actual,
    canTransitionStatus: vi.fn(() => state.canTransition),
  };
});

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      quotations: {
        findFirst: vi.fn(async (args?: { with?: unknown }) => {
          if (args?.with) return state.quotationDetail;
          return state.quote;
        }),
        findMany: vi.fn(async () => state.quotationList),
      },
      projects: {
        findFirst: vi.fn(async () => state.linkedProject),
      },
    },
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => state.quotationCount),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => {
          state.updateCalled = true;
          return {
            returning: vi.fn(async () => state.expireRows),
          };
        }),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(async () => {
        state.deleteCalled = true;
      }),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(async () => [state.txInsertedQuote]),
      })),
    })),
    transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn(async () => undefined),
          })),
        })),
        delete: vi.fn(() => ({
          where: vi.fn(async () => undefined),
        })),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            returning: vi.fn(async () => [state.txInsertedQuote]),
          })),
        })),
      };
      return await fn(tx);
    }),
  },
}));

describe("quotation-actions high-impact branches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.quote = {
      id: "11111111-1111-4111-8111-111111111111",
      status: "sent",
      quoteNumber: "QT-2026-0001",
      createdBy: "00000000-0000-4000-8000-000000000001",
    };
    state.linkedProject = null;
    state.canTransition = true;
    state.updateCalled = false;
    state.deleteCalled = false;
    state.expireRows = [];
    state.auth = { userId: "00000000-0000-4000-8000-000000000001", role: "admin" };
    state.quotationCount = [{ total: 1 }];
    state.quotationList = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        status: "draft",
        quoteNumber: "QT-2026-0001",
        customer: { name: "Customer" },
        createdBy: { name: "Admin" },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    state.quotationDetail = {
      id: "11111111-1111-4111-8111-111111111111",
      status: "draft",
      quoteNumber: "QT-2026-0001",
      createdBy: "00000000-0000-4000-8000-000000000001",
      customerId: "c1",
      subtotal: "100000",
      discountPercent: "0",
      discountAmount: "0",
      taxPercent: "0",
      taxAmount: "0",
      total: "100000",
      notes: null,
      validUntil: null,
      isArchived: false,
      archivedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [],
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
      project: null,
    };
  });

  it("gets quotations list", async () => {
    const { getQuotations } = await import("@/actions/quotation-actions");
    const res = await getQuotations({ page: 1, limit: 20 });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.total).toBe(1);
  });

  it("gets quotation detail", async () => {
    const { getQuotation } = await import("@/actions/quotation-actions");
    const res = await getQuotation("11111111-1111-4111-8111-111111111111");
    expect(res.success).toBe(true);
  });

  it("returns not found on missing quotation detail", async () => {
    state.quotationDetail = null;
    const { getQuotation } = await import("@/actions/quotation-actions");
    const res = await getQuotation("11111111-1111-4111-8111-111111111111");
    expect(res.success).toBe(false);
  });

  it("updates quotation status and notifies on accepted", async () => {
    const { updateQuotationStatus } = await import("@/actions/quotation-actions");

    const res = await updateQuotationStatus("11111111-1111-4111-8111-111111111111", "accepted");

    expect(res.success).toBe(true);
    expect(state.updateCalled).toBe(true);
    expect(spies.notifyAllUsers).toHaveBeenCalledOnce();
  });

  it("blocks status change when linked project exists", async () => {
    state.linkedProject = { id: "pj-1" };
    const { updateQuotationStatus } = await import("@/actions/quotation-actions");

    const res = await updateQuotationStatus("11111111-1111-4111-8111-111111111111", "accepted");

    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.error).toContain("already been converted to a project");
  });

  it("blocks invalid transition", async () => {
    state.canTransition = false;
    const { updateQuotationStatus } = await import("@/actions/quotation-actions");

    const res = await updateQuotationStatus("11111111-1111-4111-8111-111111111111", "accepted");

    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.error).toContain("Cannot change status");
  });

  it("deletes draft quotation for owner/admin", async () => {
    state.quote = {
      id: "11111111-1111-4111-8111-111111111111",
      status: "draft",
      quoteNumber: "QT-2026-0001",
      createdBy: state.auth.userId,
    };

    const { deleteQuotation } = await import("@/actions/quotation-actions");
    const res = await deleteQuotation("11111111-1111-4111-8111-111111111111");

    expect(res.success).toBe(true);
    expect(state.deleteCalled).toBe(true);
  });

  it("blocks delete for non-draft", async () => {
    state.quote = {
      id: "11111111-1111-4111-8111-111111111111",
      status: "accepted",
      quoteNumber: "QT-2026-0001",
      createdBy: state.auth.userId,
    };

    const { deleteQuotation } = await import("@/actions/quotation-actions");
    const res = await deleteQuotation("11111111-1111-4111-8111-111111111111");

    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.error).toContain("Only draft quotations can be deleted");
  });

  it("blocks delete when user is not owner and not admin", async () => {
    state.auth = { userId: "00000000-0000-4000-8000-000000000009", role: "staff" };
    state.quote = {
      id: "11111111-1111-4111-8111-111111111111",
      status: "draft",
      quoteNumber: "QT-2026-0001",
      createdBy: "00000000-0000-4000-8000-000000000001",
    };

    const { deleteQuotation } = await import("@/actions/quotation-actions");
    const res = await deleteQuotation("11111111-1111-4111-8111-111111111111");

    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.error).toContain("Unauthorized");
  });

  it("archives only rejected quotation", async () => {
    state.quote = {
      id: "11111111-1111-4111-8111-111111111111",
      status: "rejected",
      quoteNumber: "QT-2026-0001",
      createdBy: state.auth.userId,
    };

    const { archiveQuotation } = await import("@/actions/quotation-actions");
    const res = await archiveQuotation("11111111-1111-4111-8111-111111111111");

    expect(res.success).toBe(true);
    expect(state.updateCalled).toBe(true);
  });

  it("blocks archive for non-rejected quotation", async () => {
    state.quote = {
      id: "11111111-1111-4111-8111-111111111111",
      status: "draft",
      quoteNumber: "QT-2026-0001",
      createdBy: state.auth.userId,
    };
    const { archiveQuotation } = await import("@/actions/quotation-actions");
    const res = await archiveQuotation("11111111-1111-4111-8111-111111111111");
    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.error).toContain("Only rejected quotations can be archived");
  });

  it("restores archived quotation", async () => {
    const { restoreQuotation } = await import("@/actions/quotation-actions");
    const res = await restoreQuotation("11111111-1111-4111-8111-111111111111");
    expect(res.success).toBe(true);
    expect(state.updateCalled).toBe(true);
  });

  it("expires overdue quotations and returns count", async () => {
    state.expireRows = [{ id: "a" }, { id: "b" }];
    const { expireOverdueQuotations } = await import("@/actions/quotation-actions");
    const res = await expireOverdueQuotations();
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.expired).toBe(2);
  });

  it("updates draft quotation fields", async () => {
    state.quote = {
      id: "11111111-1111-4111-8111-111111111111",
      status: "draft",
      quoteNumber: "QT-2026-0001",
      createdBy: state.auth.userId,
    };
    const { updateQuotation } = await import("@/actions/quotation-actions");
    const res = await updateQuotation("11111111-1111-4111-8111-111111111111", {
      notes: "Updated",
      id: "11111111-1111-4111-8111-111111111111",
      validUntil: new Date("2026-06-30"),
      discountPercent: 0,
      taxPercent: 0,
      items: [
        {
          description: "Panel",
          quantity: 1,
          unitPrice: 100000,
          discountPercentage: 0,
        },
      ],
    });
    expect(res.success).toBe(true);
  });

  it("blocks update when quotation is not draft", async () => {
    state.quote = {
      id: "11111111-1111-4111-8111-111111111111",
      status: "accepted",
      quoteNumber: "QT-2026-0001",
      createdBy: state.auth.userId,
    };
    state.quotationDetail = {
      ...(state.quotationDetail as Record<string, unknown>),
      status: "accepted",
    };
    const { updateQuotation } = await import("@/actions/quotation-actions");
    const res = await updateQuotation("11111111-1111-4111-8111-111111111111", {
      id: "11111111-1111-4111-8111-111111111111",
      notes: "X",
    });
    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.error).toContain("Only draft quotations can be updated");
  });
});
