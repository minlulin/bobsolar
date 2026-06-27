import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  auth: { userId: "00000000-0000-4000-8000-000000000001", role: "admin" as const },
  quote: {
    id: "11111111-1111-4111-8111-111111111111",
    status: "draft",
    quoteNumber: "QT-2026-0001",
    createdBy: "00000000-0000-4000-8000-000000000001",
    customerId: "c1",
    subtotal: "100",
    discountPercent: "0",
    discountAmount: "0",
    taxPercent: "0",
    taxAmount: "0",
    total: "100",
    notes: null,
    validUntil: null,
    items: [],
  },
  dbMode: "ok" as "ok" | "lock_busy" | "dup_error",
  firstTxn: true,
  inventoryCostRows: [{ id: "11111111-1111-4111-8111-111111111111", costPrice: "88.40" }],
  insertedQuotationItems: [] as Array<Record<string, unknown>>,
  insertedQuotation: null as Record<string, unknown> | null,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: unknown) => fn),
}));
vi.mock("@/lib/auth/validate", () => ({
  requireAuth: vi.fn(async () => state.auth),
  requireAdmin: vi.fn(async () => state.auth),
  requireOwner: vi.fn(async () => state.auth),
}));
vi.mock("@/lib/notifications/broadcast", () => ({ notifyAllUsers: vi.fn(async () => undefined) }));
vi.mock("@/lib/utils/advisory-lock", () => ({
  AdvisoryLock: class {
    async acquire(): Promise<boolean> {
      return state.dbMode !== "lock_busy";
    }
  },
}));

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      customers: {
        findFirst: vi.fn(async () => ({
          id: "11111111-1111-4111-8111-111111111111",
          isArchived: false,
        })),
      },
      quotations: {
        // biome-ignore lint/suspicious/noExplicitAny: drizzle query mock
        findFirst: vi.fn(async (args?: any) => {
          if (args?.with) return state.quote;
          return state.quote;
        }),
        findMany: vi.fn(async () => []),
      },
      projects: { findFirst: vi.fn(async () => null) },
    },
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => [{ total: 0 }]) })) })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({ where: vi.fn(async () => ({ returning: vi.fn(async () => []) })) })),
    })),
    delete: vi.fn(() => ({ where: vi.fn(async () => undefined) })),
    // biome-ignore lint/suspicious/noExplicitAny: drizzle transaction mock
    transaction: vi.fn(async (fn: (tx: any) => Promise<any>) => {
      if (state.dbMode === "dup_error" && state.firstTxn) {
        state.firstTxn = false;
        throw { code: "23505" };
      }
      const tx = {
        query: { quotations: { findFirst: vi.fn(async () => state.quote) } },
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(async () => state.inventoryCostRows),
          })),
        })),
        insert: vi.fn(() => ({
          values: vi.fn((valuesArg: unknown) => {
            if (Array.isArray(valuesArg)) {
              state.insertedQuotationItems = valuesArg as Array<Record<string, unknown>>;
              return Promise.resolve(undefined);
            }
            state.insertedQuotation = valuesArg as Record<string, unknown>;
            return { returning: vi.fn(async () => [{ id: "q2" }]) };
          }),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) })),
        delete: vi.fn(() => ({ where: vi.fn(async () => undefined) })),
      };
      return fn(tx);
    }),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ returning: vi.fn(async () => [{ id: "q2" }]) })),
    })),
  },
}));

describe("quotation create/duplicate branches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.dbMode = "ok";
    state.firstTxn = true;
    state.inventoryCostRows = [{ id: "11111111-1111-4111-8111-111111111111", costPrice: "88.40" }];
    state.insertedQuotationItems = [];
    state.insertedQuotation = null;
  });

  it("createQuotation returns lock busy state error", async () => {
    state.dbMode = "lock_busy";
    const { createQuotation } = await import("@/actions/quotation-actions");
    const res = await createQuotation({
      customerId: "11111111-1111-4111-8111-111111111111",
      discountPercent: 0,
      taxPercent: 0,
      items: [{ description: "Panel", quantity: 1, unitPrice: 100, discountPercentage: 0 }],
    });
    expect(res.success).toBe(false);
  });

  it("createQuotation retries once on duplicate key and succeeds", async () => {
    state.dbMode = "dup_error";
    const { createQuotation } = await import("@/actions/quotation-actions");
    const res = await createQuotation({
      customerId: "11111111-1111-4111-8111-111111111111",
      discountPercent: 0,
      taxPercent: 0,
      items: [{ description: "Panel", quantity: 1, unitPrice: 100, discountPercentage: 0 }],
    });
    expect(res.success).toBe(true);
  });

  it("duplicateQuotation handles lock busy", async () => {
    state.dbMode = "lock_busy";
    const { duplicateQuotation } = await import("@/actions/quotation-actions");
    const res = await duplicateQuotation("11111111-1111-4111-8111-111111111111");
    expect(res.success).toBe(false);
  });

  it("createQuotation binds sell price from form and buy price from inventory snapshot", async () => {
    const { createQuotation } = await import("@/actions/quotation-actions");
    const res = await createQuotation({
      customerId: "11111111-1111-4111-8111-111111111111",
      discountPercent: 0,
      taxPercent: 0,
      items: [
        {
          itemId: "11111111-1111-4111-8111-111111111111",
          description: "Panel",
          quantity: 2,
          unitPrice: 1250.75,
          discountPercentage: 0,
        },
      ],
    });
    expect(res.success).toBe(true);
    expect(state.insertedQuotationItems).toHaveLength(1);
    expect(state.insertedQuotationItems[0]?.["unitPrice"]).toBe("1250.75");
    expect(state.insertedQuotationItems[0]?.["costPrice"]).toBe("88");
  });

  it("createQuotation writes user-selected quotation date as createdAt", async () => {
    const { createQuotation } = await import("@/actions/quotation-actions");
    const quotationDate = new Date("2026-05-22T00:00:00.000Z");

    const res = await createQuotation({
      customerId: "11111111-1111-4111-8111-111111111111",
      discountPercent: 0,
      taxPercent: 0,
      quotationDate,
      items: [{ description: "Panel", quantity: 1, unitPrice: 100, discountPercentage: 0 }],
    });

    expect(res.success).toBe(true);
    expect(state.insertedQuotation?.["createdAt"]).toEqual(quotationDate);
  });
});
