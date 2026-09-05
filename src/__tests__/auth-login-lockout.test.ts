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
    sessionVersion: 0,
    archivedAt: null,
  } as null | {
    id: string;
    role: string;
    passwordHash: string;
    email: string;
    sessionVersion: number;
    archivedAt: Date | null;
  },
  passwordValid: false,
}));

const spies = vi.hoisted(() => ({
  updateSet: vi.fn(),
  insertValues: vi.fn(),
  deleteWhere: vi.fn(),
}));

vi.mock("@/lib/db", () => {
  const mockDb = {
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
        return {
          onConflictDoUpdate: vi.fn().mockReturnValue({
            // lockedUntil must be strictly in the future relative to the
            // `now` captured at the start of the login call. Using a bare
            // `new Date()` made this flaky on fast machines: when the mocked
            // async chain resolves within the same millisecond, the action's
            // `lockedUntil > now` check is false and it returns
            // "Invalid credentials" instead of the lockout message.
            returning: vi.fn(() =>
              Promise.resolve([{ attempts: 5, lockedUntil: new Date(Date.now() + 60_000) }]),
            ),
          }),
        };
      }),
    })),
    delete: vi.fn(() => ({
      where: vi.fn((payload: unknown) => {
        spies.deleteWhere(payload);
        return Promise.resolve();
      }),
    })),
  };
  return { db: mockDb };
});

vi.mock("@/lib/auth/password", () => ({
  verifyPassword: vi.fn(() => Promise.resolve(state.passwordValid)),
}));

vi.mock("@/lib/auth/session", () => ({
  createSession: vi.fn(() => Promise.resolve()),
  clearSessionCookies: vi.fn(),
  getSessionFromCookie: vi.fn(() => Promise.resolve(null)),
  bumpUserSessionVersion: vi.fn(() => Promise.resolve(0)),
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
      sessionVersion: 0,
      archivedAt: null,
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
    // The upsert returns a row with lockedUntil set, which triggers the lockout message
    expect(res.error).toContain("Too many login attempts");
    expect(spies.insertValues).toHaveBeenCalledTimes(1);
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
    // Mock returning to return empty array (upsert WHERE clause won't match when already locked)
    const mockReturning = vi.fn(() => Promise.resolve([]));
    const mockOnConflictDoUpdate = vi.fn().mockReturnValue({
      returning: mockReturning,
    });
    const mockValues = vi.fn((payload: unknown) => {
      spies.insertValues(payload);
      return { onConflictDoUpdate: mockOnConflictDoUpdate };
    });
    const mockInsert = vi.fn(() => ({ values: mockValues }));

    // Replace the insert mock for this test (using any cast for test mock)
    vi.mocked((await import("@/lib/db")).db.insert).mockImplementation(mockInsert as never);

    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const { login } = await import("@/actions/auth-actions");
    const res = await login({ email: "admin@example.com", password: "bad-pass" });

    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.error).toContain("Too many login attempts");
    expect(setTimeoutSpy).toHaveBeenCalled();
    setTimeoutSpy.mockRestore();
    // mockInsert is no longer called since the pre-check returns early
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
