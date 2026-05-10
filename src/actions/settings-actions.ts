'use server';

import { db } from '@/lib/db';
import { companySettings, users, type User } from '@/lib/db/schema';
import { requireAuth, requireAdmin } from '@/lib/auth/validate';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { ActionResponse } from './inventory-actions';
import { hashPassword } from '@/lib/auth/password';

const LOGO_KEY = 'company_logo_url';

const setLogoSchema = z.object({
  url: z.string().url(),
});

const updateUserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(['admin', 'staff']),
});

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(['admin', 'staff']),
  password: z.string().min(8),
});

function makeTempPassword(): string {
  return `Tmp#${Math.random().toString(36).slice(-6)}${Date.now().toString().slice(-3)}`;
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
        companyName: map['company_name'] || 'BOB Solar',
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
    if (existing.length >= 3) {
      return { success: false, error: 'User limit reached (3 users max)' };
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
    return { success: true, data: { temporaryPassword } };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to reset password',
    };
  }
}
