import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  session: null as null | {
    userId: string;
    role: "admin" | "owner";
    sv: number;
    iat: number;
    exp: number;
  },
  user: { id: "u1", passwordHash: "hash", sessionVersion: 0 } as null | {
    id: string;
    passwordHash: string;
    sessionVersion: number;
  },
  currentPasswordValid: true,
}));

const spies = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  bumpUserSessionVersion: vi.fn(async () => 1),
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
  bumpUserSessionVersion: spies.bumpUserSessionVersion,
  createSession: vi.fn(async () => undefined),
  clearSessionCookies: vi.fn(async () => undefined),
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
    transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
      // Simulate the inner UPDATE on `users` inside the transaction,
      // so the new atomic changePassword can capture the (hash, sv) payload.
      const txUpdate = {
        update: vi.fn(() => ({
          set: vi.fn((payload: unknown) => {
            spies.updateSet(payload);
            return { where: vi.fn(async () => undefined) };
          }),
        })),
      };
      return cb(txUpdate);
    }),
  },
}));

const makeSealed = (
  overrides: Partial<{ userId: string; role: "admin" | "owner"; sv: number }> = {},
) => ({
  userId: overrides.userId ?? "u1",
  role: overrides.role ?? "admin",
  sv: overrides.sv ?? 0,
  iat: Date.now(),
  exp: Date.now() + 60_000,
});

describe("auth-actions additional branches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.session = null;
    state.user = { id: "u1", passwordHash: "hash", sessionVersion: 0 };
    state.currentPasswordValid = true;
  });

  it("logout clears cookies and returns success", async () => {
    const { logout } = await import("@/actions/auth-actions");
    const result = await logout();
    expect(result.success).toBe(true);
  });

  it("logout returns success even when no session is present", async () => {
    state.session = null;
    const { logout } = await import("@/actions/auth-actions");
    const result = await logout();
    expect(result.success).toBe(true);
  });

  it("changePassword rejects when unauthorized", async () => {
    const { changePassword } = await import("@/actions/auth-actions");
    const fd = new FormData();
    fd.set("currentPassword", "OldPass123!");
    fd.set("newPassword", "NewPassword123!");
    const res = await changePassword(fd);
    expect(res.success).toBe(false);
  });

  it("changePassword validates input", async () => {
    state.session = makeSealed();
    const { changePassword } = await import("@/actions/auth-actions");
    const fd = new FormData();
    fd.set("currentPassword", "old");
    fd.set("newPassword", "short");
    const res = await changePassword(fd);
    expect(res.success).toBe(false);
  });

  it("changePassword rejects incorrect current password", async () => {
    state.session = makeSealed();
    state.currentPasswordValid = false;
    const { changePassword } = await import("@/actions/auth-actions");
    const fd = new FormData();
    fd.set("currentPassword", "OldPass123!");
    fd.set("newPassword", "NewPassword123!");
    const res = await changePassword(fd);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("Incorrect current password");
  });

  it("changePassword success updates hash and bumps session_version", async () => {
    state.session = makeSealed();
    const { changePassword } = await import("@/actions/auth-actions");
    const fd = new FormData();
    fd.set("currentPassword", "OldPass123!");
    fd.set("newPassword", "NewPassword123!");
    const res = await changePassword(fd);
    expect(res.success).toBe(true);
    expect(spies.updateSet).toHaveBeenCalled();
    // The new UPDATE includes both the new hash AND the bumped session_version.
    const lastPayload = spies.updateSet.mock.calls.at(-1)?.[0] as
      | { passwordHash: string; sessionVersion: number }
      | undefined;
    expect(lastPayload).toMatchObject({ passwordHash: "hash:NewPassword123!" });
    expect(typeof lastPayload?.sessionVersion).toBe("number");
    const user = state.user;
    expect(user).toBeDefined();
    expect(lastPayload?.sessionVersion).toBe((user?.sessionVersion ?? 0) + 1);
  });
});
