'use server';

import { db } from '@/lib/db';
import {
  notifications,
  quotations,
  projects,
  users,
  warrantyAlerts,
  type Notification,
} from '@/lib/db/schema';
import { eq, and, desc, count, gte, lte, lt } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/validate';
import { revalidatePath } from 'next/cache';
import type { ActionResponse } from './inventory-actions';
import { handleActionError } from '@/lib/utils/error';
import { z } from 'zod';
import { addDays, endOfDay, startOfDay } from 'date-fns';

const notificationFilterSchema = z.object({
  unreadOnly: z.boolean().optional(),
});

const createNotificationSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1),
  title: z.string().min(1),
  message: z.string().min(1),
  type: z.enum(['info', 'warning', 'action']),
  link: z.string().optional().nullable(),
});

export async function getNotifications(): Promise<
  ActionResponse<Notification[]>
> {
  return getNotificationsWithFilter({});
}

export async function getNotificationsWithFilter(
  rawFilter: unknown,
): Promise<ActionResponse<Notification[]>> {
  try {
    const auth = await requireAuth();
    const filter = notificationFilterSchema.parse(rawFilter ?? {});

    const items = await db.query.notifications.findMany({
      where: and(
        eq(notifications.userId, auth.userId),
        filter.unreadOnly ? eq(notifications.isRead, false) : undefined,
      ),
      orderBy: [desc(notifications.createdAt)],
      limit: 50,
    });

    return { success: true, data: items };
  } catch (error) {
    return handleActionError(
      error,
      'getNotifications',
      'Failed to fetch notifications',
    );
  }
}

export async function getUnreadCount(): Promise<ActionResponse<number>> {
  try {
    const auth = await requireAuth();
    const [row] = await db
      .select({ total: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, auth.userId),
          eq(notifications.isRead, false),
        ),
      );
    return { success: true, data: Number(row?.total ?? 0) };
  } catch (error) {
    return handleActionError(
      error,
      'getUnreadCount',
      'Failed to fetch unread count',
    );
  }
}

export async function markNotificationAsRead(
  id: string,
): Promise<ActionResponse<void>> {
  try {
    const auth = await requireAuth();

    await db
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(eq(notifications.id, id), eq(notifications.userId, auth.userId)),
      );

    revalidatePath('/', 'layout');
    return { success: true, data: undefined };
  } catch (error) {
    return handleActionError(
      error,
      'markNotificationAsRead',
      'Failed to mark as read',
    );
  }
}

export async function deleteNotification(
  id: string,
): Promise<ActionResponse<void>> {
  try {
    const auth = await requireAuth();
    await db
      .delete(notifications)
      .where(
        and(eq(notifications.id, id), eq(notifications.userId, auth.userId)),
      );
    revalidatePath('/', 'layout');
    return { success: true, data: undefined };
  } catch (error) {
    return handleActionError(
      error,
      'deleteNotification',
      'Failed to delete notification',
    );
  }
}

export async function createNotification(
  raw: unknown,
): Promise<ActionResponse<number>> {
  try {
    await requireAuth();
    const data = createNotificationSchema.parse(raw);
    const values = data.userIds.map((userId) => ({
      userId,
      title: data.title,
      message: data.message,
      type: data.type,
      link: data.link ?? null,
      isRead: false,
    }));
    await db.insert(notifications).values(values);
    revalidatePath('/', 'layout');
    return { success: true, data: values.length };
  } catch (error) {
    return handleActionError(
      error,
      'createNotification',
      'Failed to create notification',
    );
  }
}

export async function runScheduledNotificationChecks(): Promise<
  ActionResponse<{
    expiringQuotes: number;
    dueSoonAlerts: number;
    overdueAlerts: number;
  }>
> {
  try {
    await requireAuth();
    const today = startOfDay(new Date());
    const in3Days = endOfDay(addDays(today, 3));
    const in7Days = endOfDay(addDays(today, 7));

    const allUsers = await db.select({ id: users.id }).from(users);
    const allUserIds = allUsers.map((u) => u.id);

    const admins = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, 'admin'));
    const adminIds = admins.map((a) => a.id);

    const expiringQuotes = await db
      .select({
        id: quotations.id,
        quoteNumber: quotations.quoteNumber,
        createdBy: quotations.createdBy,
      })
      .from(quotations)
      .where(
        and(
          eq(quotations.status, 'sent'),
          gte(quotations.validUntil, today),
          lte(quotations.validUntil, in3Days),
        ),
      );

    for (const q of expiringQuotes) {
      await db.insert(notifications).values({
        userId: q.createdBy,
        title: 'Quotation expiring soon',
        message: `${q.quoteNumber} expires within 3 days.`,
        type: 'warning',
        link: `/quotations/${q.id}`,
      });
    }

    const dueSoon = await db
      .select({
        id: warrantyAlerts.id,
        projectId: projects.id,
        projectNumber: projects.projectNumber,
      })
      .from(warrantyAlerts)
      .innerJoin(projects, eq(warrantyAlerts.projectId, projects.id))
      .where(
        and(
          eq(warrantyAlerts.isResolved, false),
          gte(warrantyAlerts.dueDate, today),
          lte(warrantyAlerts.dueDate, in7Days),
        ),
      );

    const overdue = await db
      .select({
        id: warrantyAlerts.id,
        projectId: projects.id,
        projectNumber: projects.projectNumber,
      })
      .from(warrantyAlerts)
      .innerJoin(projects, eq(warrantyAlerts.projectId, projects.id))
      .where(
        and(
          eq(warrantyAlerts.isResolved, false),
          lt(warrantyAlerts.dueDate, today),
        ),
      );

    const dueSoonValues = dueSoon.flatMap((a) =>
      allUserIds.map((userId) => ({
        userId,
        title: 'Warranty alert due soon',
        message: `${a.projectNumber} has an alert due within 7 days.`,
        type: 'action' as const,
        link: `/projects/${a.projectId}`,
      })),
    );
    if (dueSoonValues.length > 0)
      await db.insert(notifications).values(dueSoonValues);

    if (adminIds.length > 0) {
      const overdueValues = overdue.flatMap((a) =>
        adminIds.map((userId) => ({
          userId,
          title: 'Warranty alert overdue',
          message: `${a.projectNumber} has an overdue alert.`,
          type: 'warning' as const,
          link: `/projects/${a.projectId}`,
        })),
      );
      if (overdueValues.length > 0)
        await db.insert(notifications).values(overdueValues);
    }

    return {
      success: true,
      data: {
        expiringQuotes: expiringQuotes.length,
        dueSoonAlerts: dueSoon.length,
        overdueAlerts: overdue.length,
      },
    };
  } catch (error) {
    return handleActionError(
      error,
      'runScheduledNotificationChecks',
      'Failed to run notification checks',
    );
  }
}

export async function markAllNotificationsAsRead(): Promise<
  ActionResponse<void>
> {
  try {
    const auth = await requireAuth();

    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, auth.userId));

    revalidatePath('/', 'layout');
    return { success: true, data: undefined };
  } catch (error) {
    return handleActionError(
      error,
      'markAllNotificationsAsRead',
      'Failed to mark all as read',
    );
  }
}
