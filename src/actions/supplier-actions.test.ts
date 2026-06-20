import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  authFail: false,
  suppliersList: [
    {
      id: "22222222-2222-4222-8222-222222222222",
      name: "Supplier One",
      email: "supplier@example.com",
      phone: "0912345",
      address: null,
      companyName: "Supplier Co",
      notes: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
  supplierDetail: {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Supplier One",
    email: "supplier@example.com",
    phone: "0912345",
    address: null,
    companyName: "Supplier Co",
    notes: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Record<string, unknown> | null,
  insertedRows: [
    {
      id: "22222222-2222-4222-8222-222222222222",
      name: "Supplier One",
      email: "supplier@example.com",
      phone: "0912345",
      address: null,
      companyName: "Supplier Co",
      notes: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ] as Record<string, unknown>[],
  updatedRows: [
    {
      id: "22222222-2222-4222-8222-222222222222",
      name: "Supplier Updated",
      email: "supplier2@example.com",
      phone: "0912345",
      address: null,
      companyName: "Supplier Co",
      notes: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ] as Record<string, unknown>[],
}));

const spies = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: spies.revalidatePath }));

vi.mock("@/lib/auth/validate", () => ({
  requireOwner: vi.fn(async () => {
    if (state.authFail) throw new Error("Unauthorized");
    return { userId: "u1", role: "owner" as const };
  }),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(async () => state.suppliersList),
        })),
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

describe("supplier-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.authFail = false;
    state.supplierDetail = state.suppliersList[0] as Record<string, unknown>;
    state.insertedRows = [state.suppliersList[0] as Record<string, unknown>];
    state.updatedRows = [
      {
        ...(state.suppliersList[0] as Record<string, unknown>),
        name: "Supplier Updated",
      },
    ];
  });

  it("gets suppliers list", async () => {
    const { getSuppliers } = await import("@/actions/supplier-actions");
    const res = await getSuppliers();
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.length).toBe(1);
  });

  it("gets supplier detail", async () => {
    // Override select mock for findById
    vi.mocked((await import("@/lib/db")).db.select).mockImplementationOnce(
      () =>
        ({
          from: vi.fn(() => ({
            where: vi.fn(async () => (state.supplierDetail ? [state.supplierDetail] : [])),
          })),
        }) as unknown as never,
    );

    const { getSupplierById } = await import("@/actions/supplier-actions");
    const res = await getSupplierById("22222222-2222-4222-8222-222222222222");
    expect(res.success).toBe(true);
  });

  it("returns not found for missing supplier", async () => {
    state.supplierDetail = null;
    vi.mocked((await import("@/lib/db")).db.select).mockImplementationOnce(
      () =>
        ({
          from: vi.fn(() => ({
            where: vi.fn(async () => []),
          })),
        }) as unknown as never,
    );

    const { getSupplierById } = await import("@/actions/supplier-actions");
    const res = await getSupplierById("22222222-2222-4222-8222-222222222222");
    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.error).toContain("Supplier not found");
  });

  it("creates supplier", async () => {
    const { createSupplier } = await import("@/actions/supplier-actions");
    const res = await createSupplier({ name: "Supplier One", phone: "0912345" });
    expect(res.success).toBe(true);
    expect(spies.revalidatePath).toHaveBeenCalledWith("/suppliers");
  });

  it("fails create when insert returns empty", async () => {
    state.insertedRows = [];
    const { createSupplier } = await import("@/actions/supplier-actions");
    const res = await createSupplier({ name: "Supplier One", phone: "0912345" });
    expect(res.success).toBe(false);
  });

  it("updates supplier", async () => {
    const { updateSupplier } = await import("@/actions/supplier-actions");
    const res = await updateSupplier("22222222-2222-4222-8222-222222222222", {
      name: "Supplier Updated",
      phone: "0912345",
    });
    expect(res.success).toBe(true);
  });

  it("fails update when row missing", async () => {
    state.updatedRows = [];
    const { updateSupplier } = await import("@/actions/supplier-actions");
    const res = await updateSupplier("22222222-2222-4222-8222-222222222222", {
      name: "Supplier Updated",
      phone: "0912345",
    });
    expect(res.success).toBe(false);
  });

  it("archives supplier", async () => {
    const { deleteSupplier } = await import("@/actions/supplier-actions");
    const res = await deleteSupplier("22222222-2222-4222-8222-222222222222");
    expect(res.success).toBe(true);
  });
});
