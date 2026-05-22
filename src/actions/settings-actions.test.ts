import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  auth: { userId: "u1", role: "admin" as "admin" | "staff" },
  settingsRows: [] as Array<{ key: string; value: string }>,
  users: [] as Array<{
    id: string;
    name: string;
    email: string;
    passwordHash: string;
    role: "admin" | "staff";
  }>,
  revokedUserId: "",
}));

const spies = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  deleteCacheValue: vi.fn(),
  setCacheValue: vi.fn(),
  insertCompanyValues: vi.fn(),
  insertUserValues: vi.fn(),
  updateUsersSet: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: spies.revalidatePath,
  revalidateTag: spies.revalidateTag,
  unstable_cache: vi.fn((fn: unknown) => fn),
}));

vi.mock("@/lib/auth/validate", () => ({
  requireAuth: vi.fn(async () => state.auth),
  requireAdmin: vi.fn(async () => state.auth),
}));

vi.mock("@/lib/auth/password", () => ({
  hashPassword: vi.fn(async (p: string) => `hash:${p}`),
}));

vi.mock("@/lib/auth/session", () => ({
  revokeAllUserSessions: vi.fn(async (userId: string) => {
    state.revokedUserId = userId;
    return 1;
  }),
}));

vi.mock("@/lib/cache", () => ({
  deleteCacheValue: spies.deleteCacheValue,
  setCacheValue: spies.setCacheValue,
}));

vi.mock("@/lib/db", () => {
  const db = {
    select: vi.fn(() => ({
      from: vi.fn(async () => state.settingsRows),
    })),
    query: {
      users: {
        findFirst: vi.fn(async ({ where }: { where?: unknown }) => {
          if (!where) return state.users[0] ?? null;
          return state.users.find((u) => u.id === state.auth.userId) ?? null;
        }),
        findMany: vi.fn(async () => state.users),
      },
    },
    insert: vi.fn(() => ({
      // biome-ignore lint/suspicious/noExplicitAny: drizzle insert mock
      values: vi.fn((payload: any) => {
        const first = Array.isArray(payload) ? payload[0] : payload;
        const isSettingsPayload = first && "key" in first && "value" in first;
        if (isSettingsPayload) {
          spies.insertCompanyValues(payload);
          return {
            onConflictDoUpdate: vi.fn(async () => Promise.resolve()),
          };
        }
        spies.insertUserValues(payload);
        state.users.push({
          id: `u-${state.users.length + 1}`,
          name: payload.name,
          email: payload.email,
          passwordHash: payload.passwordHash,
          role: payload.role,
        });
        return Promise.resolve();
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn((payload: unknown) => {
        spies.updateUsersSet(payload);
        return { where: vi.fn(async () => Promise.resolve()) };
      }),
    })),
  };
  return { db };
});

describe("settings-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.auth = { userId: "u1", role: "admin" };
    state.settingsRows = [];
    state.users = [
      { id: "u1", name: "Owner", email: "owner@example.com", passwordHash: "h", role: "admin" },
      { id: "u2", name: "Peer", email: "peer@example.com", passwordHash: "h", role: "admin" },
    ];
    state.revokedUserId = "";
  });

  it("returns public branding from settings and falls back on default", async () => {
    const { getPublicCompanyBranding } = await import("@/actions/settings-actions");

    state.settingsRows = [
      { key: "company_name", value: "ACME Solar" },
      { key: "company_logo_url", value: "https://cdn/logo.png" },
    ];

    const ok = await getPublicCompanyBranding();
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.companyName).toBe("ACME Solar");
      expect(ok.data.logoUrl).toBe("https://cdn/logo.png");
    }

    state.settingsRows = [];
    const fallback = await getPublicCompanyBranding();
    expect(fallback.success).toBe(true);
    if (fallback.success) {
      expect(fallback.data.companyName).toBe("BOB Solar");
      expect(fallback.data.logoUrl).toBeNull();
    }
  });

  it("getSettingsUsers returns all users for admin and self for staff", async () => {
    const { getSettingsUsers } = await import("@/actions/settings-actions");

    state.auth = { userId: "u1", role: "admin" };
    const adminResult = await getSettingsUsers();
    expect(adminResult.success).toBe(true);
    if (adminResult.success) {
      expect(adminResult.data.isAdmin).toBe(true);
      expect(adminResult.data.users).toHaveLength(2);
    }

    state.auth = { userId: "u2", role: "staff" };
    const staffResult = await getSettingsUsers();
    expect(staffResult.success).toBe(true);
    if (staffResult.success) {
      expect(staffResult.data.isAdmin).toBe(false);
      expect(staffResult.data.users).toHaveLength(1);
      expect(staffResult.data.users[0]?.id).toBe("u2");
    }
  });

  it("setCompanyLogoUrl validates and updates caches", async () => {
    const { setCompanyLogoUrl } = await import("@/actions/settings-actions");

    const bad = await setCompanyLogoUrl({ url: "not-url" });
    expect(bad.success).toBe(false);

    const good = await setCompanyLogoUrl({ url: "https://cdn/new-logo.png" });
    expect(good.success).toBe(true);
    expect(spies.deleteCacheValue).toHaveBeenCalledTimes(2);
    expect(spies.revalidatePath).toHaveBeenCalled();
    expect(spies.revalidateTag).toHaveBeenCalled();
  });

  it("createSettingsUser enforces cap and creates admin user", async () => {
    const { createSettingsUser } = await import("@/actions/settings-actions");

    state.users = [
      { id: "1", name: "A", email: "a@x.com", passwordHash: "h", role: "admin" },
      { id: "2", name: "B", email: "b@x.com", passwordHash: "h", role: "admin" },
      { id: "3", name: "C", email: "c@x.com", passwordHash: "h", role: "admin" },
      { id: "4", name: "D", email: "d@x.com", passwordHash: "h", role: "admin" },
    ];

    const capped = await createSettingsUser({
      name: "E",
      email: "e@x.com",
      password: "Password123",
    });
    expect(capped.success).toBe(false);

    state.users.pop();
    const created = await createSettingsUser({
      name: "E",
      email: "e@x.com",
      password: "Password123",
    });

    expect(created.success).toBe(true);
    const payload = spies.insertUserValues.mock.calls.at(-1)?.[0] as {
      role: string;
      passwordHash: string;
    };
    expect(payload.role).toBe("admin");
    expect(payload.passwordHash).toContain("hash:");
  });

  it("resetSettingsUserPassword handles missing user and success path", async () => {
    const { resetSettingsUserPassword } = await import("@/actions/settings-actions");

    state.auth = { userId: "missing", role: "admin" };
    const missing = await resetSettingsUserPassword("missing");
    expect(missing.success).toBe(false);

    state.auth = { userId: "u1", role: "admin" };
    const ok = await resetSettingsUserPassword("u1");
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.temporaryPassword).toContain("Tmp#");
    }
    expect(state.revokedUserId).toBe("u1");
    expect(spies.updateUsersSet).toHaveBeenCalled();
  });

  it("updateCompanySettings filters out non-standard setting keys", async () => {
    const { updateCompanySettings } = await import("@/actions/settings-actions");

    const res = await updateCompanySettings({
      company_name: "New Name",
      invalid_spam_key: "spam value",
    });

    expect(res.success).toBe(true);
    expect(spies.insertCompanyValues).toHaveBeenCalledWith([
      { key: "company_name", value: "New Name" },
    ]);
  });
});
