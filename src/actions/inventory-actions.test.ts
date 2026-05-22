import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";

const state = vi.hoisted(() => ({
  authFail: false,
  adminFail: false,
  listRows: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Panel A",
      category: "panel",
      unit: "pcs",
      unitPrice: "1000",
      stockQty: 10,
      brand: "Jinko",
      modelNumber: "X",
      specifications: { brandModel: "Jinko X", cellType: "n_type", wattageW: 550, warranty: "12y" },
      isActive: true,
      updatedAt: new Date(),
    },
  ],
  totalRows: [{ total: 1 }],
  findItem: {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Panel A",
    category: "panel",
    unit: "pcs",
    unitPrice: "1000",
    stockQty: 10,
    brand: "Jinko",
    modelNumber: "X",
    specifications: { brandModel: "Jinko X", cellType: "n_type", wattageW: 550, warranty: "12y" },
    isActive: true,
    updatedAt: new Date(),
  } as null | Record<string, unknown>,
  insertReturning: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Panel A",
      category: "panel",
      unit: "pcs",
      unitPrice: "1000",
      stockQty: 10,
      brand: "Jinko",
      modelNumber: "X",
      specifications: { brandModel: "Jinko X", cellType: "n_type", wattageW: 550, warranty: "12y" },
      isActive: true,
      updatedAt: new Date(),
    },
  ] as Array<Record<string, unknown>>,
  updateReturning: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Panel A",
      category: "panel",
      unit: "pcs",
      unitPrice: "1500",
      stockQty: 10,
      brand: "Jinko",
      modelNumber: "X",
      specifications: { brandModel: "Jinko X", cellType: "n_type", wattageW: 550, warranty: "12y" },
      isActive: true,
      updatedAt: new Date(),
    },
  ] as Array<Record<string, unknown>>,
  categoryRows: [{ category: "panel", count: 3 }],
  txUpdates: [] as Array<{ id: string; unitPrice: string }>,
}));

const spies = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  deleteCacheValue: vi.fn(async () => undefined),
}));

vi.mock("next/cache", () => ({
  revalidatePath: spies.revalidatePath,
  revalidateTag: spies.revalidateTag,
  unstable_cache: vi.fn((fn: unknown) => fn),
}));

vi.mock("@/lib/cache", () => ({
  deleteCacheValue: spies.deleteCacheValue,
}));

vi.mock("@/lib/auth/validate", () => ({
  requireAuth: vi.fn(async () => {
    if (state.authFail) throw new Error("Unauthorized");
    return { userId: "u1", role: "admin" as const };
  }),
  requireAdmin: vi.fn(async () => {
    if (state.adminFail) throw new Error("Unauthorized");
    return { userId: "u1", role: "admin" as const };
  }),
}));

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      inventoryItems: {
        findMany: vi.fn(async () => state.listRows),
        findFirst: vi.fn(async () => state.findItem),
      },
    },
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => state.totalRows),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(async () => state.insertReturning),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(async () => state.updateReturning),
        })),
      })),
    })),
    transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        update: vi.fn(() => ({
          set: vi.fn((payload: { unitPrice: string }) => ({
            where: vi.fn(async () => {
              state.txUpdates.push({ id: "", unitPrice: payload.unitPrice });
            }),
          })),
        })),
      };
      return await fn(tx);
    }),
  },
}));

describe("inventory-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.authFail = false;
    state.adminFail = false;
    state.findItem = state.listRows[0] ?? null;
    state.insertReturning = [state.listRows[0] ?? {}];
    state.updateReturning = [
      {
        ...(state.listRows[0] ?? {}),
        unitPrice: "1500",
      },
    ];
    state.txUpdates = [];
  });

  it("gets inventory list with total", async () => {
    const { getInventoryItems } = await import("@/actions/inventory-actions");
    const res = await getInventoryItems({ search: "panel", page: 1, limit: 20 });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.total).toBe(1);
    expect(res.data.items.length).toBeGreaterThan(0);
  });

  it("gets inventory item by id", async () => {
    const { getInventoryItem } = await import("@/actions/inventory-actions");
    const res = await getInventoryItem("11111111-1111-4111-8111-111111111111");
    expect(res.success).toBe(true);
  });

  it("returns not found for missing inventory item", async () => {
    state.findItem = null;
    const { getInventoryItem } = await import("@/actions/inventory-actions");
    const res = await getInventoryItem("11111111-1111-4111-8111-111111111111");
    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.error).toContain("not found");
  });

  it("creates inventory item and revalidates cache", async () => {
    const { createInventoryItem } = await import("@/actions/inventory-actions");
    const res = await createInventoryItem({
      name: "Panel A",
      category: "panel",
      unit: "pcs",
      costPrice: 800,
      unitPrice: 1000,
      stockQty: 10,
      brand: "Jinko",
      modelNumber: "X",
      specifications: { brandModel: "Jinko X", cellType: "n_type", wattageW: 550, warranty: "12y" },
      isActive: true,
    });
    expect(res.success).toBe(true);
    expect(spies.deleteCacheValue).toHaveBeenCalledWith("inventory:categories");
    expect(spies.revalidatePath).toHaveBeenCalledWith("/inventory");
  });

  it("fails create when validation breaks", async () => {
    const { createInventoryItem } = await import("@/actions/inventory-actions");
    const res = await createInventoryItem({
      name: "",
      category: "panel",
      unit: "pcs",
      unitPrice: -1,
      stockQty: -1,
      specifications: {},
      isActive: true,
    });
    expect(res.success).toBe(false);
  });

  it("updates inventory item", async () => {
    const { updateInventoryItem } = await import("@/actions/inventory-actions");
    const res = await updateInventoryItem("11111111-1111-4111-8111-111111111111", {
      category: "panel",
      specifications: { brandModel: "Jinko X", cellType: "n_type", wattageW: 600, warranty: "12y" },
      unitPrice: 1500,
    });
    expect(res.success).toBe(true);
  });

  it("fails update when no row returned", async () => {
    state.updateReturning = [];
    const { updateInventoryItem } = await import("@/actions/inventory-actions");
    const res = await updateInventoryItem("11111111-1111-4111-8111-111111111111", {
      category: "panel",
      specifications: { brandModel: "Jinko X", cellType: "n_type", wattageW: 600, warranty: "12y" },
    });
    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.error).toContain("failed to update");
  });

  it("soft deletes inventory item", async () => {
    const { deleteInventoryItem } = await import("@/actions/inventory-actions");
    const res = await deleteInventoryItem("11111111-1111-4111-8111-111111111111");
    expect(res.success).toBe(true);
    expect(spies.revalidatePath).toHaveBeenCalledWith("/inventory");
  });

  it("bulk updates prices", async () => {
    const { bulkUpdatePrices } = await import("@/actions/inventory-actions");
    const res = await bulkUpdatePrices([
      { id: "11111111-1111-4111-8111-111111111111", unitPrice: 1200 },
      { id: "22222222-2222-4222-8222-222222222222", unitPrice: 1300 },
    ]);
    expect(res.success).toBe(true);
    expect(state.txUpdates.length).toBe(2);
  });

  it("gets inventory categories", async () => {
    vi.mocked(db.select).mockImplementationOnce(
      () =>
        ({
          from: () => ({
            where: () => ({
              groupBy: async () => state.categoryRows,
            }),
          }),
        }) as never,
    );

    const { getInventoryCategories } = await import("@/actions/inventory-actions");
    const res = await getInventoryCategories();
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data[0]?.category).toBe("panel");
  });
});
