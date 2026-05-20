import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  session: null as null | { userId: string },
  roleFromDb: null as null | string,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

vi.mock("@/lib/auth/session", () => ({
  getSessionFromCookie: vi.fn(async () => state.session),
  getUserRoleFromDb: vi.fn(async () => state.roleFromDb),
}));

describe("auth validate", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    state.session = null;
    state.roleFromDb = null;
  });

  it("requireAuth redirects to login when no session", async () => {
    const { requireAuth } = await import("@/lib/auth/validate");
    await expect(requireAuth()).rejects.toThrow("REDIRECT:/login");
  });

  it("requireAdmin redirects non-admin to home", async () => {
    state.session = { userId: "u1" };
    state.roleFromDb = "staff";

    const { requireAdmin } = await import("@/lib/auth/validate");
    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/");
  });

  it("requireFinanceAccess allows admin", async () => {
    state.session = { userId: "u1" };
    state.roleFromDb = "admin";

    const { requireFinanceAccess } = await import("@/lib/auth/validate");
    const user = await requireFinanceAccess();

    expect(user).toEqual({ userId: "u1", role: "admin" });
  });

  it("getCurrentUser returns null on invalid role", async () => {
    state.session = { userId: "u1" };
    state.roleFromDb = "invalid-role";

    const { getCurrentUser } = await import("@/lib/auth/validate");
    await expect(getCurrentUser()).resolves.toBeNull();
  });
});
