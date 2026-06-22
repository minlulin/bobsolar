import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  session: null as null | {
    userId: string;
    role: "admin" | "owner" | "technician";
    sv: number;
    iat: number;
    exp: number;
  },
  userFromDb: null as null | {
    role: "admin" | "owner" | "technician";
    sessionVersion: number;
    archivedAt: Date | null;
  },
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

vi.mock("@/lib/auth/session", () => ({
  getSessionAndRefresh: vi.fn(async () => state.session),
  getCurrentUserFromDb: vi.fn(async () => state.userFromDb),
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

const makeDb = (
  overrides: Partial<{
    role: "admin" | "owner";
    sessionVersion: number;
    archivedAt: Date | null;
  }> = {},
) => ({
  role: overrides.role ?? "admin",
  sessionVersion: overrides.sessionVersion ?? 0,
  archivedAt: overrides.archivedAt ?? null,
});

describe("auth validate", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    state.session = null;
    state.userFromDb = null;
  });

  it("requireAuth redirects to login when no session", async () => {
    const { requireAuth } = await import("@/lib/auth/validate");
    await expect(requireAuth()).rejects.toThrow("REDIRECT:/login");
  });

  it("requireAdmin redirects non-admin to unauthorized", async () => {
    state.session = makeSealed();
    state.userFromDb = makeDb({ role: "owner" });

    const { requireAdmin } = await import("@/lib/auth/validate");
    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/unauthorized");
  });

  it("requireOwner allows admin", async () => {
    state.session = makeSealed();
    state.userFromDb = makeDb({ role: "admin" });

    const { requireOwner } = await import("@/lib/auth/validate");
    const user = await requireOwner();

    expect(user).toEqual({ userId: "u1", role: "admin" });
  });

  it("requireOwner allows owner", async () => {
    state.session = makeSealed();
    state.userFromDb = makeDb({ role: "owner" });

    const { requireOwner } = await import("@/lib/auth/validate");
    const user = await requireOwner();

    expect(user).toEqual({ userId: "u1", role: "owner" });
  });

  it("rejects when session_version stamp is stale (revoked)", async () => {
    state.session = makeSealed({ sv: 0 });
    state.userFromDb = makeDb({ sessionVersion: 1 });

    const { requireAuth } = await import("@/lib/auth/validate");
    await expect(requireAuth()).rejects.toThrow("REDIRECT:/login");
  });

  it("rejects soft-archived users", async () => {
    state.session = makeSealed();
    state.userFromDb = makeDb({ archivedAt: new Date("2024-01-01") });

    const { requireAuth } = await import("@/lib/auth/validate");
    await expect(requireAuth()).rejects.toThrow("REDIRECT:/login");
  });

  it("rejects when user row is missing", async () => {
    state.session = makeSealed();
    state.userFromDb = null;

    const { requireAuth } = await import("@/lib/auth/validate");
    await expect(requireAuth()).rejects.toThrow("REDIRECT:/login");
  });

  it("getCurrentUser returns null on invalid role", async () => {
    state.session = makeSealed();
    // Force a non-enum role to trigger safeParse failure
    state.userFromDb = {
      role: "invalid-role" as unknown as "admin",
      sessionVersion: 0,
      archivedAt: null,
    };

    const { getCurrentUser } = await import("@/lib/auth/validate");
    await expect(getCurrentUser()).resolves.toBeNull();
  });
});
