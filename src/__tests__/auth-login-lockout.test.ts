import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  limitRow: null as null | {
    key: string;
    attempts: number;
    lockedUntil: Date | null;
    lastAttemptAt: Date;
    createdAt: Date;
    updatedAt: Date;
  },
  user: {
    id: "00000000-0000-4000-8000-000000000001",
    role: "admin",
    passwordHash: "hash",
    email: "admin@example.com",
  } as null | {
    id: string;
    role: string;
    passwordHash: string;
    email: string;
  },
  passwordValid: false,
}));

const spies = vi.hoisted(() => ({
  updateSet: vi.fn(),
  insertValues: vi.fn(),
  deleteWhere: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      users: {
        findFirst: vi.fn(() => Promise.resolve(state.user)),
      },
      authRateLimits: {
        findFirst: vi.fn(() => Promise.resolve(state.limitRow)),
      },
    },
    update: vi.fn(() => ({
      set: vi.fn((payload: unknown) => {
        spies.updateSet(payload);
        return { where: vi.fn(() => Promise.resolve()) };
      }),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((payload: unknown) => {
        spies.insertValues(payload);
        return Promise.resolve();
      }),
    })),
    delete: vi.fn(() => ({
      where: vi.fn((payload: unknown) => {
        spies.deleteWhere(payload);
        return Promise.resolve();
      }),
    })),
  },
}));

vi.mock("@/lib/auth/password", () => ({
  verifyPassword: vi.fn(() => Promise.resolve(state.passwordValid)),
}));

vi.mock("@/lib/auth/session", () => ({
  createSession: vi.fn(() => Promise.resolve()),
  clearSessionCookies: vi.fn(),
  deleteSession: vi.fn(),
  getSessionFromCookie: vi.fn(() => Promise.resolve(null)),
  revokeAllUserSessions: vi.fn(() => Promise.resolve(0)),
}));

describe("login lockout policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.passwordValid = false;
    state.user = {
      id: "00000000-0000-4000-8000-000000000001",
      role: "admin",
      passwordHash: "hash",
      email: "admin@example.com",
    };
    state.limitRow = null;
  });

  it("locks account after max failed attempts in active window", async () => {
    state.limitRow = {
      key: "login:admin@example.com",
      attempts: 4,
      lockedUntil: null,
      lastAttemptAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { login } = await import("@/actions/auth-actions");
    const res = await login({ email: "admin@example.com", password: "bad-pass" });

    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.error).toBe("Invalid credentials");
    expect(spies.updateSet).toHaveBeenCalledTimes(1);
    const payload = spies.updateSet.mock.calls[0]?.[0] as {
      attempts: number;
      lockedUntil: Date | null;
    };
    expect(payload.attempts).toBe(5);
    expect(payload.lockedUntil).toBeInstanceOf(Date);
  });

  it("blocks login attempts while lock window is active", async () => {
    state.limitRow = {
      key: "login:admin@example.com",
      attempts: 5,
      lockedUntil: new Date(Date.now() + 60_000),
      lastAttemptAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { login } = await import("@/actions/auth-actions");
    const res = await login({ email: "admin@example.com", password: "bad-pass" });

    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.error).toContain("Too many login attempts");
    expect(spies.updateSet).not.toHaveBeenCalled();
    expect(spies.insertValues).not.toHaveBeenCalled();
  });

  it("clears lock row after successful login", async () => {
    state.passwordValid = true;
    state.limitRow = {
      key: "login:admin@example.com",
      attempts: 2,
      lockedUntil: null,
      lastAttemptAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { login } = await import("@/actions/auth-actions");
    const res = await login({ email: "admin@example.com", password: "valid-pass" });

    expect(res.success).toBe(true);
    expect(spies.deleteWhere).toHaveBeenCalledTimes(1);
  });
});
