import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  session: null as null | { id: string; userId: string },
  user: { id: "u1", passwordHash: "hash" } as null | { id: string; passwordHash: string },
  currentPasswordValid: true,
}));

const spies = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  deleteSession: vi.fn(async () => undefined),
  clearSessionCookies: vi.fn(async () => undefined),
  revokeAllUserSessions: vi.fn(async () => 1),
  verifyPassword: vi.fn(async () => state.currentPasswordValid),
  hashPassword: vi.fn(async (v: string) => `hash:${v}`),
  updateSet: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: spies.redirect }));
vi.mock("@/lib/auth/password", () => ({
  verifyPassword: spies.verifyPassword,
  hashPassword: spies.hashPassword,
}));
vi.mock("@/lib/auth/session", () => ({
  getSessionFromCookie: vi.fn(async () => state.session),
  deleteSession: spies.deleteSession,
  clearSessionCookies: spies.clearSessionCookies,
  revokeAllUserSessions: spies.revokeAllUserSessions,
  createSession: vi.fn(async () => undefined),
}));
vi.mock("@/lib/db", () => ({
  db: {
    query: {
      users: {
        findFirst: vi.fn(async () => state.user),
      },
      authRateLimits: {
        findFirst: vi.fn(async () => null),
      },
    },
    update: vi.fn(() => ({
      set: vi.fn((payload: unknown) => {
        spies.updateSet(payload);
        return { where: vi.fn(async () => undefined) };
      }),
    })),
    insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
    delete: vi.fn(() => ({ where: vi.fn(async () => undefined) })),
  },
}));

describe("auth-actions additional branches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.session = null;
    state.user = { id: "u1", passwordHash: "hash" };
    state.currentPasswordValid = true;
  });

  it("logout clears cookies and redirects even without session", async () => {
    const { logout } = await import("@/actions/auth-actions");
    await expect(logout()).rejects.toThrow("REDIRECT:/login");
    expect(spies.clearSessionCookies).toHaveBeenCalled();
    expect(spies.deleteSession).not.toHaveBeenCalled();
  });

  it("logout deletes session when exists", async () => {
    state.session = { id: "s1", userId: "u1" };
    const { logout } = await import("@/actions/auth-actions");
    await expect(logout()).rejects.toThrow("REDIRECT:/login");
    expect(spies.deleteSession).toHaveBeenCalledWith("s1");
  });

  it("changePassword rejects when unauthorized", async () => {
    const { changePassword } = await import("@/actions/auth-actions");
    const fd = new FormData();
    fd.set("currentPassword", "oldpass123");
    fd.set("newPassword", "newpass123");
    const res = await changePassword(fd);
    expect(res.success).toBe(false);
  });

  it("changePassword validates input", async () => {
    state.session = { id: "s1", userId: "u1" };
    const { changePassword } = await import("@/actions/auth-actions");
    const fd = new FormData();
    fd.set("currentPassword", "old");
    fd.set("newPassword", "short");
    const res = await changePassword(fd);
    expect(res.success).toBe(false);
  });

  it("changePassword rejects incorrect current password", async () => {
    state.session = { id: "s1", userId: "u1" };
    state.currentPasswordValid = false;
    const { changePassword } = await import("@/actions/auth-actions");
    const fd = new FormData();
    fd.set("currentPassword", "oldpass123");
    fd.set("newPassword", "newpass123");
    const res = await changePassword(fd);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("Incorrect current password");
  });

  it("changePassword success updates hash and revokes sessions", async () => {
    state.session = { id: "s1", userId: "u1" };
    const { changePassword } = await import("@/actions/auth-actions");
    const fd = new FormData();
    fd.set("currentPassword", "oldpass123");
    fd.set("newPassword", "newpass123");
    const res = await changePassword(fd);
    expect(res.success).toBe(true);
    expect(spies.updateSet).toHaveBeenCalled();
    expect(spies.revokeAllUserSessions).toHaveBeenCalledWith("u1", "s1");
  });
});
