import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  authFail: false,
  customersList: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Aung Aung",
      email: "aung@example.com",
      phone: "091234",
      address: null,
      city: null,
      notes: null,
      isArchived: false,
      archivedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
  totalRows: [{ total: 1 }],
  customerDetail: {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Aung Aung",
    email: "aung@example.com",
    phone: "091234",
    address: null,
    city: null,
    notes: null,
    isArchived: false,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    quotations: [],
    projects: [],
  } as Record<string, unknown> | null,
  insertedRows: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Aung Aung",
      email: "aung@example.com",
      phone: "091234",
      address: null,
      city: null,
      notes: null,
      isArchived: false,
      archivedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ] as Record<string, unknown>[],
  updatedRows: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Aung Aung Updated",
      email: "aung2@example.com",
      phone: "091234",
      address: null,
      city: null,
      notes: null,
      isArchived: false,
      archivedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ] as Record<string, unknown>[],
  searchRows: [] as Record<string, unknown>[],
}));

const spies = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: spies.revalidatePath }));

vi.mock("@/lib/auth/validate", () => ({
  requireAuth: vi.fn(async () => {
    if (state.authFail) throw new Error("Unauthorized");
    return { userId: "u1", role: "admin" as const };
  }),
}));

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      customers: {
        findMany: vi.fn(async () =>
          state.searchRows.length > 0 ? state.searchRows : state.customersList,
        ),
        findFirst: vi.fn(async () => state.customerDetail),
      },
      projects: {
        findFirst: vi.fn(async () => null),
      },
      quotations: {
        findFirst: vi.fn(async () => null),
      },
    },
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => state.totalRows),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(async () => state.insertedRows),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(async () => state.updatedRows),
        })),
      })),
    })),
  },
}));

describe("customer-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.authFail = false;
    state.searchRows = [];
    state.customerDetail = {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Aung Aung",
      email: "aung@example.com",
      phone: "091234",
      address: null,
      city: null,
      notes: null,
      isArchived: false,
      archivedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      quotations: [],
      projects: [],
    };
    state.insertedRows = [state.customersList[0] as Record<string, unknown>];
    state.updatedRows = [
      {
        ...(state.customersList[0] as Record<string, unknown>),
        name: "Aung Aung Updated",
      },
    ];
  });

  it("gets customers list", async () => {
    const { getCustomers } = await import("@/actions/customer-actions");
    const res = await getCustomers({ page: 1, limit: 20, search: "Aung" });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.total).toBe(1);
  });

  it("gets customer detail", async () => {
    const { getCustomer } = await import("@/actions/customer-actions");
    const res = await getCustomer("11111111-1111-4111-8111-111111111111");
    expect(res.success).toBe(true);
  });

  it("returns not found for missing customer", async () => {
    state.customerDetail = null;
    const { getCustomer } = await import("@/actions/customer-actions");
    const res = await getCustomer("11111111-1111-4111-8111-111111111111");
    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.error).toContain("Customer not found");
  });

  it("creates customer", async () => {
    const { createCustomer } = await import("@/actions/customer-actions");
    const res = await createCustomer({ name: "Aung", phone: "09123", email: "a@a.com" });
    expect(res.success).toBe(true);
    expect(spies.revalidatePath).toHaveBeenCalledWith("/customers");
  });

  it("fails create when insert returns empty", async () => {
    state.insertedRows = [];
    const { createCustomer } = await import("@/actions/customer-actions");
    const res = await createCustomer({ name: "Aung", phone: "09123" });
    expect(res.success).toBe(false);
  });

  it("updates customer", async () => {
    const { updateCustomer } = await import("@/actions/customer-actions");
    const res = await updateCustomer("11111111-1111-4111-8111-111111111111", {
      name: "Aung Aung Updated",
      phone: "09123",
      email: "a2@a.com",
    });
    expect(res.success).toBe(true);
  });

  it("fails update when row missing", async () => {
    state.updatedRows = [];
    const { updateCustomer } = await import("@/actions/customer-actions");
    const res = await updateCustomer("11111111-1111-4111-8111-111111111111", {
      name: "X",
      phone: "09123",
    });
    expect(res.success).toBe(false);
  });

  it("archives customer", async () => {
    const { deleteCustomer } = await import("@/actions/customer-actions");
    const res = await deleteCustomer("11111111-1111-4111-8111-111111111111");
    expect(res.success).toBe(true);
  });

  it("searches customers", async () => {
    state.searchRows = [state.customersList[0] as Record<string, unknown>];
    const { searchCustomers } = await import("@/actions/customer-actions");
    const res = await searchCustomers("Aung");
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.length).toBe(1);
  });
});
