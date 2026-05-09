import { db } from '@/lib/db';
import { users, notifications } from '@/lib/db/schema';

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
