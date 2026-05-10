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
import type { ActionResponse } from '@/lib/utils/action-response';
import { handleActionError } from '@/lib/utils/error';
import { z } from 'zod';
import { addDays, endOfDay, startOfDay } from 'date-fns';
import {
  QUOTATION_EXPIRY_WARNING_DAYS,
  WARRANTY_NOTIFICATION_WINDOW_DAYS,
} from '@/lib/domain/policies';
import { uuidSchema } from '@/lib/validators/common';

const notificationFilterSchema = z.object({
  unreadOnly: z.boolean().optional(),
});

const createNotificationSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1),
  title: z.string().min(1),
  message: z.string().min(1),
  type: z.enum(['info', 'warning', 'action']),
  link: z.string().optional().nullable(),
  dedupeKey: z.string().optional(),
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
    const validatedId = uuidSchema.parse(id);

    await db
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(notifications.id, validatedId),
          eq(notifications.userId, auth.userId),
        ),
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
    const validatedId = uuidSchema.parse(id);
    await db
      .delete(notifications)
      .where(
        and(
          eq(notifications.id, validatedId),
          eq(notifications.userId, auth.userId),
        ),
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

    let createdCount = 0;

    if (data.dedupeKey) {
      // Use deduplication - only create if doesn't exist for each user
      for (const userId of data.userIds) {
        // Check if notification with this dedupe key already exists for this user
        const existing = await db.query.notifications.findFirst({
          where: and(
            eq(notifications.userId, userId),
            eq(notifications.notificationDedupeKey, data.dedupeKey!),
          ),
        });

        if (!existing) {
          await db.insert(notifications).values({
            userId,
            title: data.title,
            message: data.message,
            type: data.type,
            link: data.link ?? null,
            isRead: false,
            notificationDedupeKey: data.dedupeKey,
          });
          createdCount++;
        }
      }
    } else {
      // No deduplication - create for all users
      const values = data.userIds.map((userId) => ({
        userId,
        title: data.title,
        message: data.message,
        type: data.type,
        link: data.link ?? null,
        isRead: false,
      }));
      await db.insert(notifications).values(values);
      createdCount = values.length;
    }

    revalidatePath('/', 'layout');
    return { success: true, data: createdCount };
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
    const in3Days = endOfDay(addDays(today, QUOTATION_EXPIRY_WARNING_DAYS));
    const in7Days = endOfDay(addDays(today, WARRANTY_NOTIFICATION_WINDOW_DAYS));

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
      const dedupeKey = `quote-expiring-${q.id}`;
      // Check if notification already exists
      const existing = await db.query.notifications.findFirst({
        where: and(
          eq(notifications.userId, q.createdBy),
          eq(notifications.notificationDedupeKey, dedupeKey),
        ),
      });

      if (!existing) {
        await db.insert(notifications).values({
          userId: q.createdBy,
          title: 'Quotation expiring soon',
          message: `${q.quoteNumber} expires within ${QUOTATION_EXPIRY_WARNING_DAYS} days.`,
          type: 'warning',
          link: `/quotations/${q.id}`,
          notificationDedupeKey: dedupeKey,
        });
      }
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

    // Create due soon notifications with deduplication
    for (const a of dueSoon) {
      const dedupeKey = `warranty-due-soon-${a.id}`;
      for (const userId of allUserIds) {
        const existing = await db.query.notifications.findFirst({
          where: and(
            eq(notifications.userId, userId),
            eq(notifications.notificationDedupeKey, dedupeKey),
          ),
        });

        if (!existing) {
          await db.insert(notifications).values({
            userId,
            title: 'Warranty alert due soon',
            message: `${a.projectNumber} has an alert due within ${WARRANTY_NOTIFICATION_WINDOW_DAYS} days.`,
            type: 'action' as const,
            link: `/projects/${a.projectId}`,
            notificationDedupeKey: dedupeKey,
          });
        }
      }
    }

    // Create overdue notifications with deduplication
    if (adminIds.length > 0) {
      for (const a of overdue) {
        const dedupeKey = `warranty-overdue-${a.id}`;
        for (const userId of adminIds) {
          const existing = await db.query.notifications.findFirst({
            where: and(
              eq(notifications.userId, userId),
              eq(notifications.notificationDedupeKey, dedupeKey),
            ),
          });

          if (!existing) {
            await db.insert(notifications).values({
              userId,
              title: 'Warranty alert overdue',
              message: `${a.projectNumber} has an overdue alert.`,
              type: 'warning' as const,
              link: `/projects/${a.projectId}`,
              notificationDedupeKey: dedupeKey,
            });
          }
        }
      }
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
