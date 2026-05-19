"use server";

import { randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { z } from "zod";
import { hashPassword } from "@/lib/auth/password";
import { revokeAllUserSessions } from "@/lib/auth/session";
import { requireAdmin, requireAuth } from "@/lib/auth/validate";
import { deleteCacheValue, setCacheValue } from "@/lib/cache";
import { db } from "@/lib/db";
import { companySettings, type User, users } from "@/lib/db/schema";
import { USER_CAP } from "@/lib/domain/policies";
import { COMPANY_SETTING_KEYS } from "@/lib/domain/settings-keys";
import { type ActionResponse, errorResponse, successResponse } from "@/lib/utils/action-response";

const LOGO_KEY = COMPANY_SETTING_KEYS.LOGO_URL;

const setLogoSchema = z.object({
  url: z.url(),
});

const updateUserSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  email: z.email(),
});

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
  password: z.string().min(8),
});

function makeTempPassword(): string {
  // Use cryptographically secure random bytes (16 bytes = 32 hex chars)
  return `Tmp#${randomBytes(16).toString("hex")}`;
}

const getCachedCompanySettingsRows = unstable_cache(
  async (): Promise<{ key: string; value: string }[]> => {
    return db
      .select({ key: companySettings.key, value: companySettings.value })
      .from(companySettings);
  },
  ["settings:company-rows"],
  { tags: ["settings:company"], revalidate: 600 },
);

async function getCachedCompanySettingsMap(): Promise<Record<string, string>> {
  const rows = await getCachedCompanySettingsRows();
  const loaded: Record<string, string> = {};
  for (const row of rows) loaded[row.key] = row.value;
  return loaded;
}

export async function getCompanySettings(): Promise<ActionResponse<Record<string, string>>> {
  // Auth gate is intentionally outside `try/catch` so that `redirect()` thrown
  // by `requireAuth()` / `requireAdmin()` propagates to Next.js instead of
  // being caught and serialised as `{ success: false, error: "NEXT_REDIRECT" }`.
  await requireAuth();
  try {
    const map = await getCachedCompanySettingsMap();
    return successResponse(map);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to load settings");
  }
}

export async function setCompanyLogoUrl(raw: unknown): Promise<ActionResponse<{ url: string }>> {
  await requireAdmin();
  try {
    const { url } = setLogoSchema.parse(raw);

    await db
      .insert(companySettings)
      .values({ key: LOGO_KEY, value: url })
      .onConflictDoUpdate({
        target: companySettings.key,
        set: { value: url, updatedAt: new Date() },
      });
    await deleteCacheValue("settings:company");
    await deleteCacheValue("settings:branding");

    revalidateTag("settings:company", "default");
    revalidatePath("/settings");
    revalidatePath("/", "layout");

    return successResponse({ url });
  } catch (error) {
    return errorResponse(
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? "Invalid URL")
        : error instanceof Error
          ? error.message
          : "Failed to save logo",
    );
  }
}

export async function updateCompanySettings(
  data: Record<string, string>,
): Promise<ActionResponse<null>> {
  await requireAdmin();
  try {
    const entries = Object.entries(data);
    if (entries.length > 0) {
      await db
        .insert(companySettings)
        .values(entries.map(([key, value]) => ({ key, value })))
        .onConflictDoUpdate({
          target: companySettings.key,
          set: { value: sql`excluded.value`, updatedAt: new Date() },
        });
    }
    await deleteCacheValue("settings:company");
    await deleteCacheValue("settings:branding");

    revalidateTag("settings:company", "default");
    revalidatePath("/settings");

    return successResponse(null);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to save settings");
  }
}

export async function getCompanyLogoUrl(): Promise<string | null> {
  const settings = await getCachedCompanySettingsMap();
  return settings[LOGO_KEY] ?? null;
}

export async function getPublicCompanyBranding(): Promise<
  ActionResponse<{ companyName: string; logoUrl: string | null }>
> {
  try {
    const map = await getCachedCompanySettingsMap();
    return successResponse({
      companyName: map[COMPANY_SETTING_KEYS.NAME] || "BOB Solar",
      logoUrl: map[LOGO_KEY] || null,
    });
  } catch {
    // Keep login usable even when company settings storage is unavailable.
    return successResponse({
      companyName: "BOB Solar",
      logoUrl: null,
    });
  }
}

export async function getSettingsUsers(): Promise<
  ActionResponse<{ isAdmin: boolean; users: User[]; me: User | null }>
> {
  const auth = await requireAuth();
  try {
    const me = await db.query.users.findFirst({
      where: eq(users.id, auth.userId),
    });
    if (!me) return errorResponse("User not found");

    const isAdmin = auth.role === "admin";
    // Non-admin callers only see themselves; admins see the full roster.
    const userRows = isAdmin ? await db.query.users.findMany() : [me];
    return successResponse({ isAdmin, users: userRows, me });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to load users");
  }
}

export async function updateSettingsUser(raw: unknown): Promise<ActionResponse<null>> {
  await requireAdmin();
  try {
    const parsed = updateUserSchema.parse(raw);
    await db
      .update(users)
      .set({ name: parsed.name, email: parsed.email })
      .where(eq(users.id, parsed.id));
    await setCacheValue("settings:last-user-mutation", String(Date.now()), {
      ttlSeconds: 300,
    });
    revalidatePath("/settings");
    return successResponse(null);
  } catch (error) {
    return errorResponse(
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? "Validation failed")
        : error instanceof Error
          ? error.message
          : "Failed to update user",
    );
  }
}

export async function createSettingsUser(raw: unknown): Promise<ActionResponse<null>> {
  await requireAdmin();
  try {
    const parsed = createUserSchema.parse(raw);
    const existing = await db.query.users.findMany();
    if (existing.length >= USER_CAP) {
      return errorResponse(`User limit reached (${USER_CAP} users max)`);
    }
    const passwordHash = await hashPassword(parsed.password);
    await db.insert(users).values({
      name: parsed.name,
      email: parsed.email,
      passwordHash,
      role: "admin",
    });
    await setCacheValue("settings:last-user-mutation", String(Date.now()), {
      ttlSeconds: 300,
    });
    revalidatePath("/settings");
    return successResponse(null);
  } catch (error) {
    return errorResponse(
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? "Validation failed")
        : error instanceof Error
          ? error.message
          : "Failed to create user",
    );
  }
}

export async function resetSettingsUserPassword(
  userId: string,
): Promise<ActionResponse<{ temporaryPassword: string }>> {
  await requireAdmin();
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (!user) return errorResponse("User not found");

    const temporaryPassword = makeTempPassword();
    const passwordHash = await hashPassword(temporaryPassword);
    await db.update(users).set({ passwordHash }).where(eq(users.id, userId));

    // Revoke all sessions for this user (force re-login with temp password)
    await revokeAllUserSessions(userId);

    return successResponse({ temporaryPassword });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to reset password");
  }
}
