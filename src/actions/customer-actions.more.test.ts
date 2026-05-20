import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  authFail: false,
  throwOnFindMany: false,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
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
        findMany: vi.fn(async () => {
          if (state.throwOnFindMany) throw new Error("db fail");
          return [];
        }),
        findFirst: vi.fn(async () => null),
      },
    },
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => [{ total: 0 }]) })) })),
    insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn(async () => []) })) })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(async () => []) })) })),
    })),
  },
}));

describe("customer-actions extra errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.authFail = false;
    state.throwOnFindMany = false;
  });

  it("getCustomers handles auth failure", async () => {
    state.authFail = true;
    const { getCustomers } = await import("@/actions/customer-actions");
    const res = await getCustomers({ page: 1, limit: 20 });
    expect(res.success).toBe(false);
  });

  it("searchCustomers handles db failure", async () => {
    state.throwOnFindMany = true;
    const { searchCustomers } = await import("@/actions/customer-actions");
    const res = await searchCustomers("abc");
    expect(res.success).toBe(false);
  });

  it("deleteCustomer handles invalid uuid", async () => {
    const { deleteCustomer } = await import("@/actions/customer-actions");
    const res = await deleteCustomer("bad-id");
    expect(res.success).toBe(false);
  });
});
