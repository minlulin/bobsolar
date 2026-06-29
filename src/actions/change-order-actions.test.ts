import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  auth: { userId: "00000000-0000-4000-8000-000000000001", role: "admin" as "admin" | "owner" },
  project: {
    id: "11111111-1111-4111-8111-111111111111",
    projectNumber: "PJ-2026-0001",
    status: "in_progress",
    quotedTotal: "100000",
    actualTotal: "0",
    // biome-ignore lint/suspicious/noExplicitAny: test mock project
  } as any,
  co: {
    id: "co-1",
    projectId: "11111111-1111-4111-8111-111111111111",
    changeOrderNumber: "PJ-2026-0001-CO-1",
    description: "Add panels",
    additionalAmount: "50000",
    status: "draft",
    // biome-ignore lint/suspicious/noExplicitAny: test mock state
  } as any,
  // biome-ignore lint/suspicious/noExplicitAny: test mock state
  existingCos: [] as any[],
  // biome-ignore lint/suspicious/noExplicitAny: test mock state
  approvedCos: [] as any[],
  journalPosted: false,
  // biome-ignore lint/suspicious/noExplicitAny: test mock state
  journalLines: [] as any[],
  dbUpdateCalled: false,
  updatedProjectTotal: "",
}));

const spies = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  createBalancedJournalEntry: vi.fn(async ({ lines }) => {
    state.journalPosted = true;
    state.journalLines = lines;
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: spies.revalidatePath,
  revalidateTag: spies.revalidateTag,
}));

vi.mock("@/lib/auth/validate", () => ({
  requireAuth: vi.fn(async () => state.auth),
  requireAdmin: vi.fn(async () => state.auth),
  requireOwner: vi.fn(async () => state.auth),
}));

vi.mock("@/lib/finance/ledger", () => ({
  createBalancedJournalEntry: spies.createBalancedJournalEntry,
}));

vi.mock("@/lib/finance/cache-invalidation", () => ({
  invalidateFinanceCacheForWrite: vi.fn(),
}));

import { projectChangeOrders, projects } from "@/lib/db/schema";

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      projectChangeOrders: {
        findMany: vi.fn(async () => [state.co]),
      },
    },
    // biome-ignore lint/suspicious/noExplicitAny: test mock transaction callback
    transaction: vi.fn(async (cb: any) => {
      const tx = {
        execute: vi.fn(async () => ({ rows: [{ locked: true }] })),
        // biome-ignore lint/suspicious/noExplicitAny: test mock select argument
        select: vi.fn((_selectFields?: any) => {
          return {
            // biome-ignore lint/suspicious/noExplicitAny: test mock table
            from: vi.fn((table: any) => {
              const selectChain = {
                // biome-ignore lint/suspicious/noExplicitAny: test mock condition
                where: vi.fn((_cond?: any) => {
                  const whereChain = {
                    for: vi.fn(async () => {
                      if (table === projects) {
                        return [state.project];
                      }
                      if (table === projectChangeOrders) {
                        return [state.co];
                      }
                      return [];
                    }),
                  };
                  return {
                    ...whereChain,
                    // biome-ignore lint/suspicious/noThenProperty: mock thenable for await
                    // biome-ignore lint/suspicious/noExplicitAny: mock resolve
                    then: (resolve: any) => {
                      if (table === projectChangeOrders) {
                        resolve(state.approvedCos);
                      } else {
                        resolve([]);
                      }
                    },
                  };
                }),
              };
              return selectChain;
            }),
          };
        }),
        // biome-ignore lint/suspicious/noExplicitAny: test mock table
        insert: vi.fn((table: any) => ({
          values: vi.fn(() => ({
            returning: vi.fn(async () => {
              if (table === projectChangeOrders) {
                return [state.co];
              }
              return [];
            }),
          })),
        })),
        // biome-ignore lint/suspicious/noExplicitAny: test mock table
        update: vi.fn((table: any) => ({
          // biome-ignore lint/suspicious/noExplicitAny: test mock fields
          set: vi.fn((fields: any) => {
            if (table === projects && fields.actualTotal !== undefined) {
              state.updatedProjectTotal = fields.actualTotal;
            }
            return {
              where: vi.fn(() => {
                state.dbUpdateCalled = true;
                return {
                  returning: vi.fn(async () => {
                    if (table === projectChangeOrders) {
                      return [{ ...state.co, ...fields }];
                    }
                    return [];
                  }),
                };
              }),
            };
          }),
        })),
      };
      return cb(tx);
    }),
  },
}));

describe("change-order-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.journalPosted = false;
    state.journalLines = [];
    state.dbUpdateCalled = false;
    state.updatedProjectTotal = "";
    state.project = {
      id: "11111111-1111-4111-8111-111111111111",
      projectNumber: "PJ-2026-0001",
      status: "in_progress",
      quotedTotal: "100000",
      actualTotal: "0",
    };
    state.co = {
      id: "co-1",
      projectId: "11111111-1111-4111-8111-111111111111",
      changeOrderNumber: "PJ-2026-0001-CO-1",
      description: "Add panels",
      additionalAmount: "50000",
      status: "draft",
    };
    state.approvedCos = [];
  });

  it("creates change order successfully", async () => {
    const { createChangeOrder } = await import("@/actions/change-order-actions");
    const res = await createChangeOrder({
      projectId: "11111111-1111-4111-8111-111111111111",
      description: "Extra panels",
      items: [
        {
          description: "Panel",
          quantity: 2,
          unitPrice: 25000,
          isAddition: true,
        },
      ],
    });

    expect(res.success).toBe(true);
  });

  it("approves change order, recalculates project total, and posts balanced journal", async () => {
    state.approvedCos = [{ amount: "50000" }];
    const { approveChangeOrder } = await import("@/actions/change-order-actions");
    const res = await approveChangeOrder("co-1");

    expect(res.success).toBe(true);
    expect(state.dbUpdateCalled).toBe(true);
    expect(state.updatedProjectTotal).toBe("150000"); // 100000 quoted + 50000 approved CO
    expect(state.journalPosted).toBe(true);
    expect(state.journalLines).toEqual([
      { accountCode: "accounts_receivable", debit: 50000, credit: 0 },
      { accountCode: "solar_installation_revenue", debit: 0, credit: 50000 },
    ]);
  });

  it("cancels approved change order, recalculates project total, and reverses journal", async () => {
    state.co.status = "approved";
    state.approvedCos = []; // No approved COs remaining
    const { cancelChangeOrder } = await import("@/actions/change-order-actions");
    const res = await cancelChangeOrder("co-1");

    expect(res.success).toBe(true);
    expect(state.dbUpdateCalled).toBe(true);
    expect(state.updatedProjectTotal).toBe("100000"); // 100000 quoted + 0 approved COs
    expect(state.journalPosted).toBe(true);
    expect(state.journalLines).toEqual([
      { accountCode: "solar_installation_revenue", debit: 50000, credit: 0 },
      { accountCode: "accounts_receivable", debit: 0, credit: 50000 },
    ]);
  });
});
