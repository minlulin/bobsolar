"use server";

import { addDays, endOfDay, startOfDay } from "date-fns";
import { and, count, desc, eq, gte, inArray, lt, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, requireAuth } from "@/lib/auth/validate";
import { db } from "@/lib/db";
import {
  type NewNotification,
  type Notification,
  notifications,
  projects,
  quotations,
  users,
  warrantyAlerts,
} from "@/lib/db/schema";
import { notificationTypeSchema } from "@/lib/domain/enums";
import {
  QUOTATION_EXPIRY_WARNING_DAYS,
  WARRANTY_NOTIFICATION_WINDOW_DAYS,
} from "@/lib/domain/policies";
import { type ActionResponse, successResponse } from "@/lib/utils/action-response";
import { handleActionError } from "@/lib/utils/error";
import { uuidSchema } from "@/lib/validators/common";

const notificationFilterSchema = z.object({
  unreadOnly: z.boolean().optional(),
});

const createNotificationSchema = z.object({
  userIds: z.array(z.uuid()).min(1),
  title: z.string().min(1),
  message: z.string().min(1),
  type: notificationTypeSchema,
  link: z
    .string()
    .optional()
    .nullable()
    .refine(
      (value) =>
        value == null ||
        (/^\/(?!\/)/.test(value) &&
          // biome-ignore lint/suspicious/noControlCharactersInRegex: Intentional security check rejecting control chars in URLs
          !/[\\\u0000-\u001F]/.test(value) &&
          !/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value)),
      "Notification link must be a safe internal route",
    ),
  dedupeKey: z.string().optional(),
});

function buildExistingNotificationMap(
  existingRows: Array<{
    userId: string;
    notificationDedupeKey: string | null;
  }>,
): Set<string> {
  return new Set(
    existingRows
      .filter(
        (row): row is { userId: string; notificationDedupeKey: string } =>
          row.notificationDedupeKey !== null,
      )
      .map((row) => `${row.userId}:${row.notificationDedupeKey}`),
  );
}

function filterNewNotifications(
  candidates: NewNotification[],
  existingKeys: Set<string>,
): NewNotification[] {
  return candidates.filter((candidate) => {
    const dedupeKey = candidate.notificationDedupeKey;
    if (!dedupeKey) return true;
    return !existingKeys.has(`${candidate.userId}:${dedupeKey}`);
  });
}

export async function getNotifications(): Promise<ActionResponse<Notification[]>> {
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

    return successResponse(items);
  } catch (error) {
    return handleActionError(error, "getNotifications", "Failed to fetch notifications");
  }
}

export async function getUnreadCount(): Promise<ActionResponse<number>> {
  try {
    const auth = await requireAuth();
    const [row] = await db
      .select({ total: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, auth.userId), eq(notifications.isRead, false)));
    return successResponse(row?.total ?? 0);
  } catch (error) {
    return handleActionError(error, "getUnreadCount", "Failed to fetch unread count");
  }
}

export async function markNotificationAsRead(id: string): Promise<ActionResponse<null>> {
  try {
    const auth = await requireAuth();
    const validatedId = uuidSchema.parse(id);

    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, validatedId), eq(notifications.userId, auth.userId)));

    revalidatePath("/", "layout");
    return successResponse(null);
  } catch (error) {
    return handleActionError(error, "markNotificationAsRead", "Failed to mark as read");
  }
}

export async function deleteNotification(id: string): Promise<ActionResponse<null>> {
  try {
    const auth = await requireAuth();
    const validatedId = uuidSchema.parse(id);
    await db
      .delete(notifications)
      .where(and(eq(notifications.id, validatedId), eq(notifications.userId, auth.userId)));
    revalidatePath("/", "layout");
    return successResponse(null);
  } catch (error) {
    return handleActionError(error, "deleteNotification", "Failed to delete notification");
  }
}

export async function createNotification(raw: unknown): Promise<ActionResponse<number>> {
  try {
    await requireAdmin();
    const data = createNotificationSchema.parse(raw);

    let createdCount = 0;

    if (data.dedupeKey) {
      const existingRows = await db
        .select({
          userId: notifications.userId,
          notificationDedupeKey: notifications.notificationDedupeKey,
        })
        .from(notifications)
        .where(
          and(
            inArray(notifications.userId, data.userIds),
            eq(notifications.notificationDedupeKey, data.dedupeKey),
          ),
        );

      const existingKeys = buildExistingNotificationMap(existingRows);
      const candidates: NewNotification[] = data.userIds.map((userId) => ({
        userId,
        title: data.title,
        message: data.message,
        type: data.type,
        link: data.link ?? null,
        isRead: false,
        notificationDedupeKey: data.dedupeKey,
      }));
      const toInsert = filterNewNotifications(candidates, existingKeys);
      if (toInsert.length > 0) {
        const inserted = await db
          .insert(notifications)
          .values(toInsert)
          .onConflictDoNothing({
            target: [notifications.userId, notifications.notificationDedupeKey],
          })
          .returning({ id: notifications.id });
        createdCount = inserted.length;
      } else {
        createdCount = 0;
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

    revalidatePath("/", "layout");
    return successResponse(createdCount);
  } catch (error) {
    return handleActionError(error, "createNotification", "Failed to create notification");
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
    await requireAdmin();
    const today = startOfDay(new Date());
    const in3Days = endOfDay(addDays(today, QUOTATION_EXPIRY_WARNING_DAYS));
    const in7Days = endOfDay(addDays(today, WARRANTY_NOTIFICATION_WINDOW_DAYS));

    const allUsers = await db.select({ id: users.id }).from(users);
    const allUserIds = allUsers.map((u) => u.id);

    const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
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
          eq(quotations.status, "sent"),
          gte(quotations.validUntil, today),
          lte(quotations.validUntil, in3Days),
        ),
      );

    const expiringCandidates: NewNotification[] = expiringQuotes.map((q) => ({
      userId: q.createdBy,
      title: "Quotation expiring soon",
      message: `${q.quoteNumber} expires within ${QUOTATION_EXPIRY_WARNING_DAYS} days.`,
      type: "warning",
      link: `/quotations/${q.id}`,
      notificationDedupeKey: `quote-expiring-${q.id}`,
    }));

    if (expiringCandidates.length > 0) {
      const dedupeKeys = expiringCandidates
        .map((c) => c.notificationDedupeKey)
        .filter((v): v is string => typeof v === "string");
      const createdByIds = Array.from(new Set(expiringQuotes.map((q) => q.createdBy)));
      const existingExpiring = await db
        .select({
          userId: notifications.userId,
          notificationDedupeKey: notifications.notificationDedupeKey,
        })
        .from(notifications)
        .where(
          and(
            inArray(notifications.userId, createdByIds),
            inArray(notifications.notificationDedupeKey, dedupeKeys),
          ),
        );
      const existingKeys = buildExistingNotificationMap(existingExpiring);
      const toInsert = filterNewNotifications(expiringCandidates, existingKeys);
      if (toInsert.length > 0) {
        await db
          .insert(notifications)
          .values(toInsert)
          .onConflictDoNothing({
            target: [notifications.userId, notifications.notificationDedupeKey],
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
      .where(and(eq(warrantyAlerts.isResolved, false), lt(warrantyAlerts.dueDate, today)));

    const dueSoonCandidates: NewNotification[] = dueSoon.flatMap((alert) => {
      const dedupeKey = `warranty-due-soon-${alert.id}`;
      return allUserIds.map((userId) => ({
        userId,
        title: "Warranty alert due soon",
        message: `${alert.projectNumber} has an alert due within ${WARRANTY_NOTIFICATION_WINDOW_DAYS} days.`,
        type: "action" as const,
        link: `/projects/${alert.projectId}`,
        notificationDedupeKey: dedupeKey,
      }));
    });

    const overdueCandidates: NewNotification[] = overdue.flatMap((alert) => {
      const dedupeKey = `warranty-overdue-${alert.id}`;
      return adminIds.map((userId) => ({
        userId,
        title: "Warranty alert overdue",
        message: `${alert.projectNumber} has an overdue alert.`,
        type: "warning" as const,
        link: `/projects/${alert.projectId}`,
        notificationDedupeKey: dedupeKey,
      }));
    });

    const dueSoonDedupeKeys = dueSoon.map((alert) => `warranty-due-soon-${alert.id}`);
    const overdueDedupeKeys = overdue.map((alert) => `warranty-overdue-${alert.id}`);

    if (dueSoonCandidates.length > 0 && dueSoonDedupeKeys.length > 0) {
      const existingDueSoon = await db
        .select({
          userId: notifications.userId,
          notificationDedupeKey: notifications.notificationDedupeKey,
        })
        .from(notifications)
        .where(
          and(
            inArray(notifications.userId, allUserIds),
            inArray(notifications.notificationDedupeKey, dueSoonDedupeKeys),
          ),
        );

      const existingKeys = buildExistingNotificationMap(existingDueSoon);
      const toInsert = filterNewNotifications(dueSoonCandidates, existingKeys);
      if (toInsert.length > 0) {
        await db
          .insert(notifications)
          .values(toInsert)
          .onConflictDoNothing({
            target: [notifications.userId, notifications.notificationDedupeKey],
          });
      }
    }

    if (overdueCandidates.length > 0 && overdueDedupeKeys.length > 0 && adminIds.length > 0) {
      const existingOverdue = await db
        .select({
          userId: notifications.userId,
          notificationDedupeKey: notifications.notificationDedupeKey,
        })
        .from(notifications)
        .where(
          and(
            inArray(notifications.userId, adminIds),
            inArray(notifications.notificationDedupeKey, overdueDedupeKeys),
          ),
        );

      const existingKeys = buildExistingNotificationMap(existingOverdue);
      const toInsert = filterNewNotifications(overdueCandidates, existingKeys);
      if (toInsert.length > 0) {
        await db
          .insert(notifications)
          .values(toInsert)
          .onConflictDoNothing({
            target: [notifications.userId, notifications.notificationDedupeKey],
          });
      }
    }

    return successResponse({
      expiringQuotes: expiringQuotes.length,
      dueSoonAlerts: dueSoon.length,
      overdueAlerts: overdue.length,
    });
  } catch (error) {
    return handleActionError(
      error,
      "runScheduledNotificationChecks",
      "Failed to run notification checks",
    );
  }
}

export async function markAllNotificationsAsRead(): Promise<ActionResponse<null>> {
  try {
    const auth = await requireAuth();

    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, auth.userId));

    revalidatePath("/", "layout");
    return successResponse(null);
  } catch (error) {
    return handleActionError(error, "markAllNotificationsAsRead", "Failed to mark all as read");
  }
}
