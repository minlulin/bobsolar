import { db } from '@/lib/db';
import { users, notifications } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export type BroadcastNotificationInput = {
  title: string;
  message: string;
  type: 'info' | 'warning' | 'action';
  link?: string | null;
};

export async function notifyAllUsers(
  payload: BroadcastNotificationInput,
): Promise<void> {
  const allUsers = await db.select({ id: users.id }).from(users);
  if (allUsers.length === 0) return;

  await db.insert(notifications).values(
    allUsers.map((u) => ({
      userId: u.id,
      title: payload.title,
      message: payload.message,
      type: payload.type,
      link: payload.link ?? null,
    })),
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

  await db.insert(notifications).values(
    admins.map((u) => ({
      userId: u.id,
      title: payload.title,
      message: payload.message,
      type: payload.type,
      link: payload.link ?? null,
    })),
  );
}
