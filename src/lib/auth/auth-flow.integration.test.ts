import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Authentication flow integration tests.
 *
 * Tests the complete authentication pipeline by mocking the session layer
 * and testing the validate module's behavior with various session states.
 */

const mockGetSessionAndRefresh = vi.fn();
const mockGetCurrentUserFromDb = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  getSessionAndRefresh: mockGetSessionAndRefresh,
  getCurrentUserFromDb: mockGetCurrentUserFromDb,
  createSession: vi.fn(async () => {}),
  clearSessionCookies: vi.fn(async () => {}),
  bumpUserSessionVersion: vi.fn(async () => 1),
  SESSION_COOKIE_NAME: "bobsolar_session",
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

describe("authentication flow integration", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockGetSessionAndRefresh.mockReset();
    mockGetCurrentUserFromDb.mockReset();
  });

  afterEach(() => {
    for (const k of Object.keys(process.env)) {
      if (!(k in originalEnv)) delete process.env[k];
    }
    Object.assign(process.env, originalEnv);
    vi.resetModules();
  });

  describe("session validation pipeline", () => {
    it("authenticates valid session with matching sv", async () => {
      mockGetSessionAndRefresh.mockResolvedValue({
        userId: "user-1",
        role: "admin",
        sv: 5,
        iat: Date.now(),
        exp: Date.now() + 60000,
      });
      mockGetCurrentUserFromDb.mockResolvedValue({
        role: "admin",
        sessionVersion: 5,
        archivedAt: null,
      });

      const { requireAuth } = await import("@/lib/auth/validate");
      const user = await requireAuth();

      expect(user).toEqual({ userId: "user-1", role: "admin" });
    });

    it("rejects expired/missing session", async () => {
      mockGetSessionAndRefresh.mockResolvedValue(null);

      const { requireAuth } = await import("@/lib/auth/validate");
      await expect(requireAuth()).rejects.toThrow("REDIRECT:/login");
    });

    it("rejects when session version is stale (revoked)", async () => {
      mockGetSessionAndRefresh.mockResolvedValue({
        userId: "user-1",
        role: "admin",
        sv: 3,
        iat: Date.now(),
        exp: Date.now() + 60000,
      });
      mockGetCurrentUserFromDb.mockResolvedValue({
        role: "admin",
        sessionVersion: 5,
        archivedAt: null,
      });

      const { requireAuth } = await import("@/lib/auth/validate");
      await expect(requireAuth()).rejects.toThrow("REDIRECT:/login");
    });

    it("rejects soft-archived users", async () => {
      mockGetSessionAndRefresh.mockResolvedValue({
        userId: "user-1",
        role: "admin",
        sv: 5,
        iat: Date.now(),
        exp: Date.now() + 60000,
      });
      mockGetCurrentUserFromDb.mockResolvedValue({
        role: "admin",
        sessionVersion: 5,
        archivedAt: new Date("2024-01-01"),
      });

      const { requireAuth } = await import("@/lib/auth/validate");
      await expect(requireAuth()).rejects.toThrow("REDIRECT:/login");
    });

    it("rejects when user row is missing from DB", async () => {
      mockGetSessionAndRefresh.mockResolvedValue({
        userId: "deleted-user",
        role: "admin",
        sv: 0,
        iat: Date.now(),
        exp: Date.now() + 60000,
      });
      mockGetCurrentUserFromDb.mockResolvedValue(null);

      const { requireAuth } = await import("@/lib/auth/validate");
      await expect(requireAuth()).rejects.toThrow("REDIRECT:/login");
    });

    it("rejects invalid role from DB", async () => {
      mockGetSessionAndRefresh.mockResolvedValue({
        userId: "user-1",
        role: "admin",
        sv: 0,
        iat: Date.now(),
        exp: Date.now() + 60000,
      });
      mockGetCurrentUserFromDb.mockResolvedValue({
        role: "invalid_role" as string,
        sessionVersion: 0,
        archivedAt: null,
      });

      const { requireAuth } = await import("@/lib/auth/validate");
      await expect(requireAuth()).rejects.toThrow("REDIRECT:/login");
    });
  });

  describe("role-based access control", () => {
    it("requireAdmin allows admin role", async () => {
      mockGetSessionAndRefresh.mockResolvedValue({
        userId: "admin-1",
        role: "admin",
        sv: 0,
        iat: Date.now(),
        exp: Date.now() + 60000,
      });
      mockGetCurrentUserFromDb.mockResolvedValue({
        role: "admin",
        sessionVersion: 0,
        archivedAt: null,
      });

      const { requireAdmin } = await import("@/lib/auth/validate");
      const user = await requireAdmin();
      expect(user.role).toBe("admin");
    });

    it("requireAdmin rejects owner role", async () => {
      mockGetSessionAndRefresh.mockResolvedValue({
        userId: "owner-1",
        role: "owner",
        sv: 0,
        iat: Date.now(),
        exp: Date.now() + 60000,
      });
      mockGetCurrentUserFromDb.mockResolvedValue({
        role: "owner",
        sessionVersion: 0,
        archivedAt: null,
      });

      const { requireAdmin } = await import("@/lib/auth/validate");
      await expect(requireAdmin()).rejects.toThrow("REDIRECT:/unauthorized");
    });

    it("requireOwner allows admin role", async () => {
      mockGetSessionAndRefresh.mockResolvedValue({
        userId: "admin-1",
        role: "admin",
        sv: 0,
        iat: Date.now(),
        exp: Date.now() + 60000,
      });
      mockGetCurrentUserFromDb.mockResolvedValue({
        role: "admin",
        sessionVersion: 0,
        archivedAt: null,
      });

      const { requireOwner } = await import("@/lib/auth/validate");
      const user = await requireOwner();
      expect(user.role).toBe("admin");
    });

    it("requireOwner allows owner role", async () => {
      mockGetSessionAndRefresh.mockResolvedValue({
        userId: "owner-1",
        role: "owner",
        sv: 0,
        iat: Date.now(),
        exp: Date.now() + 60000,
      });
      mockGetCurrentUserFromDb.mockResolvedValue({
        role: "owner",
        sessionVersion: 0,
        archivedAt: null,
      });

      const { requireOwner } = await import("@/lib/auth/validate");
      const user = await requireOwner();
      expect(user.role).toBe("owner");
    });
  });

  describe("getCurrentUser (non-redirecting)", () => {
    it("returns user for valid session", async () => {
      mockGetSessionAndRefresh.mockResolvedValue({
        userId: "user-1",
        role: "owner",
        sv: 0,
        iat: Date.now(),
        exp: Date.now() + 60000,
      });
      mockGetCurrentUserFromDb.mockResolvedValue({
        role: "owner",
        sessionVersion: 0,
        archivedAt: null,
      });

      const { getCurrentUser } = await import("@/lib/auth/validate");
      const user = await getCurrentUser();
      expect(user).toEqual({ userId: "user-1", role: "owner" });
    });

    it("returns null for invalid session (no redirect)", async () => {
      mockGetSessionAndRefresh.mockResolvedValue(null);

      const { getCurrentUser } = await import("@/lib/auth/validate");
      const user = await getCurrentUser();
      expect(user).toBeNull();
    });
  });

  describe("session revocation flow", () => {
    it("bumping session version invalidates existing sessions", async () => {
      // First: authenticate successfully with sv=0
      mockGetSessionAndRefresh.mockResolvedValue({
        userId: "user-1",
        role: "admin",
        sv: 0,
        iat: Date.now(),
        exp: Date.now() + 60000,
      });
      mockGetCurrentUserFromDb.mockResolvedValue({
        role: "admin",
        sessionVersion: 0,
        archivedAt: null,
      });

      const { requireAuth } = await import("@/lib/auth/validate");
      const user = await requireAuth();
      expect(user).toBeDefined();

      // Now bump version in DB (simulating revocation)
      mockGetCurrentUserFromDb.mockResolvedValue({
        role: "admin",
        sessionVersion: 1, // Version bumped
        archivedAt: null,
      });

      // Old session with sv=0 should now be rejected
      await expect(requireAuth()).rejects.toThrow("REDIRECT:/login");
    });
  });

  describe("role change propagation", () => {
    it("picks up role changes from DB on next request", async () => {
      // User was owner, promoted to admin
      mockGetSessionAndRefresh.mockResolvedValue({
        userId: "user-1",
        role: "owner", // Cookie still says owner
        sv: 0,
        iat: Date.now(),
        exp: Date.now() + 60000,
      });
      mockGetCurrentUserFromDb.mockResolvedValue({
        role: "admin", // DB says admin now
        sessionVersion: 0,
        archivedAt: null,
      });

      const { requireAdmin } = await import("@/lib/auth/validate");
      // Should succeed because DB role is authoritative
      const user = await requireAdmin();
      expect(user.role).toBe("admin");
    });
  });

  describe("chat access control (requireChatAccess)", () => {
    it("allows admin to access chat", async () => {
      mockGetSessionAndRefresh.mockResolvedValue({
        userId: "admin-1",
        role: "admin",
        sv: 0,
        iat: Date.now(),
        exp: Date.now() + 60000,
      });
      mockGetCurrentUserFromDb.mockResolvedValue({
        role: "admin",
        sessionVersion: 0,
        archivedAt: null,
      });

      const { requireChatAccess } = await import("@/lib/auth/validate");
      const user = await requireChatAccess();
      expect(user.role).toBe("admin");
    });

    it("allows owner to access chat", async () => {
      mockGetSessionAndRefresh.mockResolvedValue({
        userId: "owner-1",
        role: "owner",
        sv: 0,
        iat: Date.now(),
        exp: Date.now() + 60000,
      });
      mockGetCurrentUserFromDb.mockResolvedValue({
        role: "owner",
        sessionVersion: 0,
        archivedAt: null,
      });

      const { requireChatAccess } = await import("@/lib/auth/validate");
      const user = await requireChatAccess();
      expect(user.role).toBe("owner");
    });

    it("allows technician to access chat", async () => {
      mockGetSessionAndRefresh.mockResolvedValue({
        userId: "tech-1",
        role: "technician",
        sv: 0,
        iat: Date.now(),
        exp: Date.now() + 60000,
      });
      mockGetCurrentUserFromDb.mockResolvedValue({
        role: "technician",
        sessionVersion: 0,
        archivedAt: null,
      });

      const { requireChatAccess } = await import("@/lib/auth/validate");
      const user = await requireChatAccess();
      expect(user.role).toBe("technician");
      expect(user.userId).toBe("tech-1");
    });

    it("rejects unauthenticated users", async () => {
      mockGetSessionAndRefresh.mockResolvedValue(null);

      const { requireChatAccess } = await import("@/lib/auth/validate");
      await expect(requireChatAccess()).rejects.toThrow("REDIRECT:/login");
    });
  });
});
