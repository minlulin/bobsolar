import { db } from '@/lib/db';
import { users, notifications } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export type BroadcastNotificationInput = {
  title: string;
  message: string;
  type: 'info' | 'warning' | 'action';
  link?: string | null;
  dedupeKey?: string;
};

async function insertNotifications(
  userIds: string[],
  payload: BroadcastNotificationInput,
): Promise<void> {
  if (userIds.length === 0) return;

  const values = userIds.map((userId) => ({
    userId,
    title: payload.title,
    message: payload.message,
    type: payload.type,
    link: payload.link ?? null,
    notificationDedupeKey: payload.dedupeKey ?? null,
  }));

  const insert = payload.dedupeKey
    ? db
        .insert(notifications)
        .values(values)
        .onConflictDoNothing({
          target: [notifications.userId, notifications.notificationDedupeKey],
        })
    : db.insert(notifications).values(values);

  await insert;
}

export async function notifyAllUsers(
  payload: BroadcastNotificationInput,
): Promise<void> {
  const allUsers = await db.select({ id: users.id }).from(users);
  if (allUsers.length === 0) return;

  await insertNotifications(
    allUsers.map((u) => u.id),
    payload,
  );
}

export async function notifyAdminUsers(
  payload: BroadcastNotificationInput,
): Promise<void> {
  const admins = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, 'admin'));
  if (admins.length === 0) return;

  await insertNotifications(
    admins.map((a) => a.id),
    payload,
  );
}
