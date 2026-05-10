'use server';

import { db } from '@/lib/db';
import { companySettings } from '@/lib/db/schema';
import { requireAuth } from '@/lib/auth/validate';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { ActionResponse } from './inventory-actions';

const LOGO_KEY = 'company_logo_url';

const setLogoSchema = z.object({
  url: z.string().url(),
});

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
