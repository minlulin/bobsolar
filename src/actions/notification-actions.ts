'use server';

import { db } from '@/lib/db';
import { notifications } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/validate';
import { revalidatePath } from 'next/cache';
import type { ActionResponse } from './inventory-actions';
import { handleActionError } from '@/lib/utils/error';

export async function getNotifications(): Promise<ActionResponse<any[]>> {
  try {
    const auth = await requireAuth();

    const items = await db.query.notifications.findMany({
      where: eq(notifications.userId, auth.userId),
      orderBy: [desc(notifications.createdAt)],
      limit: 50,
    });

    return { success: true, data: items };
  } catch (error) {
    return handleActionError(error, 'getNotifications', 'Failed to fetch notifications');
  }
}

export async function markNotificationAsRead(id: string): Promise<ActionResponse<void>> {
  try {
    const auth = await requireAuth();

    await db.update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, auth.userId)));

    revalidatePath('/', 'layout');
    return { success: true, data: undefined };
  } catch (error) {
    return handleActionError(error, 'markNotificationAsRead', 'Failed to mark as read');
  }
}

export async function markAllNotificationsAsRead(): Promise<ActionResponse<void>> {
  try {
    const auth = await requireAuth();

    await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, auth.userId));

    revalidatePath('/', 'layout');
    return { success: true, data: undefined };
  } catch (error) {
    return handleActionError(error, 'markAllNotificationsAsRead', 'Failed to mark all as read');
  }
}
