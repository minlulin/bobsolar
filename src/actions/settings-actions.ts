'use server';

import { randomBytes } from 'crypto';
import { db } from '@/lib/db';
import { companySettings, users, type User } from '@/lib/db/schema';
import { requireAuth, requireAdmin } from '@/lib/auth/validate';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { ActionResponse } from '@/lib/utils/action-response';
import { hashPassword } from '@/lib/auth/password';
import { revokeAllUserSessions } from '@/lib/auth/session';
import { userRoleSchema } from '@/lib/domain/enums';
import { COMPANY_SETTING_KEYS } from '@/lib/domain/settings-keys';
import { USER_CAP } from '@/lib/domain/policies';

const LOGO_KEY = COMPANY_SETTING_KEYS.LOGO_URL;

const setLogoSchema = z.object({
  url: z.string().url(),
});

const updateUserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
  role: userRoleSchema,
});

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: userRoleSchema,
  password: z.string().min(8),
});

function makeTempPassword(): string {
  // Use cryptographically secure random bytes (16 bytes = 32 hex chars)
  return `Tmp#${randomBytes(16).toString('hex')}`;
}

export async function getCompanySettings(): Promise<
  ActionResponse<Record<string, string>>
> {
  try {
    await requireAuth();
    const rows = await db.select().from(companySettings);
    const map: Record<string, string> = {};
    for (const row of rows) {
      map[row.key] = row.value;
    }
    return { success: true, data: map };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load settings',
    };
  }
}

export async function setCompanyLogoUrl(
  raw: unknown,
): Promise<ActionResponse<{ url: string }>> {
  try {
    await requireAuth();
    const { url } = setLogoSchema.parse(raw);

    await db
      .insert(companySettings)
      .values({ key: LOGO_KEY, value: url })
      .onConflictDoUpdate({
        target: companySettings.key,
        set: { value: url, updatedAt: new Date() },
      });

    revalidatePath('/settings');
    revalidatePath('/', 'layout');

    return { success: true, data: { url } };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof z.ZodError
          ? (error.issues[0]?.message ?? 'Invalid URL')
          : error instanceof Error
            ? error.message
            : 'Failed to save logo',
    };
  }
}

export async function updateCompanySettings(
  data: Record<string, string>,
): Promise<ActionResponse<void>> {
  try {
    await requireAuth();

    await db.transaction(async (tx) => {
      for (const [key, value] of Object.entries(data)) {
        await tx
          .insert(companySettings)
          .values({ key, value })
          .onConflictDoUpdate({
            target: companySettings.key,
            set: { value, updatedAt: new Date() },
          });
      }
    });

    revalidatePath('/settings');

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save settings',
    };
  }
}

export async function getCompanyLogoUrl(): Promise<string | null> {
  const [row] = await db
    .select()
    .from(companySettings)
    .where(eq(companySettings.key, LOGO_KEY))
    .limit(1);
  return row?.value ?? null;
}

export async function getPublicCompanyBranding(): Promise<
  ActionResponse<{ companyName: string; logoUrl: string | null }>
> {
  try {
    const rows = await db.select().from(companySettings);
    const map: Record<string, string> = {};
    for (const row of rows) map[row.key] = row.value;
    return {
      success: true,
      data: {
        companyName: map[COMPANY_SETTING_KEYS.NAME] || 'BOB Solar',
        logoUrl: map[LOGO_KEY] || null,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load branding',
    };
  }
}

export async function getSettingsUsers(): Promise<
  ActionResponse<{ isAdmin: boolean; users: User[]; me: User | null }>
> {
  try {
    const auth = await requireAuth();
    const me = await db.query.users.findFirst({
      where: eq(users.id, auth.userId),
    });
    if (!me) return { success: false, error: 'User not found' };

    if (auth.role !== 'admin') {
      return { success: true, data: { isAdmin: false, users: [], me } };
    }

    const userRows = await db.query.users.findMany();
    return { success: true, data: { isAdmin: true, users: userRows, me } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load users',
    };
  }
}

export async function updateSettingsUser(
  raw: unknown,
): Promise<ActionResponse<void>> {
  try {
    await requireAdmin();
    const parsed = updateUserSchema.parse(raw);
    await db
      .update(users)
      .set({ name: parsed.name, email: parsed.email, role: parsed.role })
      .where(eq(users.id, parsed.id));
    revalidatePath('/settings');
    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof z.ZodError
          ? (error.issues[0]?.message ?? 'Validation failed')
          : error instanceof Error
            ? error.message
            : 'Failed to update user',
    };
  }
}

export async function createSettingsUser(
  raw: unknown,
): Promise<ActionResponse<void>> {
  try {
    await requireAdmin();
    const parsed = createUserSchema.parse(raw);
    const existing = await db.query.users.findMany();
    if (existing.length >= USER_CAP) {
      return { success: false, error: `User limit reached (${USER_CAP} users max)` };
    }
    const passwordHash = await hashPassword(parsed.password);
    await db.insert(users).values({
      name: parsed.name,
      email: parsed.email,
      role: parsed.role,
      passwordHash,
    });
    revalidatePath('/settings');
    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof z.ZodError
          ? (error.issues[0]?.message ?? 'Validation failed')
          : error instanceof Error
            ? error.message
            : 'Failed to create user',
    };
  }
}

export async function resetSettingsUserPassword(
  userId: string,
): Promise<ActionResponse<{ temporaryPassword: string }>> {
  try {
    await requireAdmin();
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (!user) return { success: false, error: 'User not found' };

    const temporaryPassword = makeTempPassword();
    const passwordHash = await hashPassword(temporaryPassword);
    await db.update(users).set({ passwordHash }).where(eq(users.id, userId));

    // Revoke all sessions for this user (force re-login with temp password)
    await revokeAllUserSessions(userId);

    return { success: true, data: { temporaryPassword } };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to reset password',
    };
  }
}
