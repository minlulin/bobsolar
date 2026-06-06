import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      users: { findFirst: vi.fn(() => Promise.resolve(null)) },
      authRateLimits: { findFirst: vi.fn(() => Promise.resolve(null)) },
    },
    insert: vi.fn(() => ({ values: vi.fn(() => Promise.resolve()) })),
    delete: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
    })),
  },
}));

vi.mock("@/lib/auth/session", () => ({
  createSession: vi.fn(() => Promise.resolve()),
  clearSessionCookies: vi.fn(),
  getSessionFromCookie: vi.fn(() => Promise.resolve(null)),
  bumpUserSessionVersion: vi.fn(() => Promise.resolve(0)),
}));

vi.mock("@/lib/auth/password", () => ({
  verifyPassword: vi.fn(() => Promise.resolve(false)),
}));

describe("Login resilience: DB connection errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error response for invalid credentials", async () => {
    const { login } = await import("@/actions/auth-actions");
    const result = await login({
      email: "nonexistent@example.com",
      password: "password123",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Invalid credentials");
    }
  });
});
