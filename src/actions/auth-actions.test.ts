import { beforeEach, describe, expect, it, vi } from "vitest";
import { login } from "@/actions/auth-actions";

const state = vi.hoisted(() => ({
  user: {
    id: "u1",
    role: "admin",
    passwordHash: "hash",
    sessionVersion: 0,
    archivedAt: null as Date | null,
  } as {
    id: string;
    role: "admin" | "owner";
    passwordHash: string;
    sessionVersion: number;
    archivedAt: Date | null;
  } | null,
  rateLimit: null as { attempts: number; lockedUntil: Date | null } | null,
  passwordValid: true,
}));

const spies = vi.hoisted(() => ({
  verifyPassword: vi.fn(async () => state.passwordValid),
  createSession: vi.fn(async () => undefined),
  dbInsert: vi.fn(),
  dbUpdate: vi.fn(),
  dbDelete: vi.fn(),
}));

vi.mock("@/lib/auth/password", () => ({
  verifyPassword: spies.verifyPassword,
}));

vi.mock("@/lib/auth/session", () => ({
  createSession: spies.createSession,
}));

vi.mock("@/lib/db", () => {
  const mockDb = {
    query: {
      users: {
        findFirst: vi.fn(async () => state.user),
      },
      authRateLimits: {
        findFirst: vi.fn(async () => state.rateLimit),
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoUpdate: vi.fn(() => ({
          returning: vi.fn(async () => {
            spies.dbInsert();
            return [state.rateLimit || { attempts: 1, lockedUntil: null }];
          }),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(async () => {
          spies.dbUpdate();
        }),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(async () => {
        spies.dbDelete();
      }),
    })),
  };
  return { db: mockDb };
});

describe("auth-actions login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.user = {
      id: "u1",
      role: "admin",
      passwordHash: "hash",
      sessionVersion: 0,
      archivedAt: null,
    };
    state.rateLimit = null;
    state.passwordValid = true;
  });

  it("fails on invalid input", async () => {
    const res = await login({ email: "not-an-email", password: "123" });
    expect(res.success).toBe(false);
  });

  it("fails when user is not found", async () => {
    state.user = null;
    const res = await login({ email: "test@example.com", password: "password" });
    expect(res.success).toBe(false);
    expect(spies.dbInsert).toHaveBeenCalled(); // rate limit incremented
  });

  it("fails when user is archived", async () => {
    if (state.user) state.user.archivedAt = new Date();
    const res = await login({ email: "test@example.com", password: "password" });
    expect(res.success).toBe(false);
  });

  it("fails when password is wrong", async () => {
    state.passwordValid = false;
    const res = await login({ email: "test@example.com", password: "wrong-password" });
    expect(res.success).toBe(false);
  });

  it("fails when locked out", async () => {
    state.rateLimit = { attempts: 5, lockedUntil: new Date(Date.now() + 60000) };
    const res = await login({ email: "test@example.com", password: "password" });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toContain("Too many login attempts");
    }
  });

  it("locks out user when max attempts reached", async () => {
    state.passwordValid = false;
    state.rateLimit = { attempts: 5, lockedUntil: null };
    const res = await login({ email: "test@example.com", password: "wrong-password" });
    expect(res.success).toBe(false);
    expect(spies.dbUpdate).toHaveBeenCalled(); // lockedUntil updated
  });

  it("succeeds with valid credentials", async () => {
    const res = await login({ email: "test@example.com", password: "password" });
    expect(res.success).toBe(true);
    expect(spies.createSession).toHaveBeenCalledWith("u1", "admin", 0);
    expect(spies.dbDelete).toHaveBeenCalled(); // rate limit cleared
  });

  it("fails safely if createSession throws", async () => {
    spies.createSession.mockRejectedValueOnce(new Error("Redis offline"));
    const res = await login({ email: "test@example.com", password: "password" });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toContain("Authentication service misconfigured");
    }
  });
});
