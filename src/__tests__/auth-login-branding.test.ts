import { beforeEach, describe, expect, it, vi } from "vitest";

const queryState = vi.hoisted(() => ({
  shouldThrowBrandingQuery: false,
}));

const sessionState = vi.hoisted(() => ({
  shouldFailSessionCreation: false,
}));

vi.mock("@/lib/db", () => {
  const mockDb = {
    query: {
      users: {
        findFirst: vi.fn(() => ({
          id: "00000000-0000-4000-8000-000000000001",
          role: "admin",
          passwordHash: "$2a$10$abcdefghijklmnopqrstuv123456789012345678901234567890",
          email: "admin@example.com",
          sessionVersion: 0,
          archivedAt: null,
        })),
      },
      authRateLimits: {
        findFirst: vi.fn(() => null),
      },
    },
    delete: vi.fn(() => ({
      where: vi.fn(() => []),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => Promise.resolve()),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => {
        if (queryState.shouldThrowBrandingQuery) {
          throw new Error('relation "company_settings" does not exist');
        }
        return [];
      }),
    })),
  };
  return { db: mockDb };
});

vi.mock("@/lib/auth/password", () => ({
  verifyPassword: vi.fn(() => Promise.resolve(true)),
}));

vi.mock("@/lib/auth/session", () => ({
  createSession: vi.fn(() => {
    if (sessionState.shouldFailSessionCreation) {
      throw new Error("SESSION_SECRET is not set");
    }
    return undefined;
  }),
  clearSessionCookies: vi.fn(),
  getSessionFromCookie: vi.fn(() => Promise.resolve(null)),
  bumpUserSessionVersion: vi.fn(() => Promise.resolve(0)),
}));

describe("auth and branding resilience", () => {
  beforeEach(() => {
    queryState.shouldThrowBrandingQuery = false;
    sessionState.shouldFailSessionCreation = false;
  });

  it("returns default public branding when company settings query fails", async () => {
    queryState.shouldThrowBrandingQuery = true;
    const { getPublicCompanyBranding } = await import("@/actions/settings-actions");
    const res = await getPublicCompanyBranding();
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.companyName).toBe("BOB Solar");
    expect(res.data.logoUrl).toBeNull();
  });

  it("returns actionable login error instead of throwing on session misconfiguration", async () => {
    sessionState.shouldFailSessionCreation = true;
    const { login } = await import("@/actions/auth-actions");
    const res = await login({
      email: "admin@example.com",
      password: "password123",
    });
    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.error).toContain("Authentication service misconfigured");
  });
});
