import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { sessions } from '@/lib/db/schema';
import { eq, lt } from 'drizzle-orm';

const SESSION_COOKIE_NAME = 'session_id';
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function createSession(
  userId: string,
  role: string,
): Promise<string> {
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await db.insert(sessions).values({
    id: sessionId,
    userId,
    role,
    expiresAt,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DURATION_MS / 1000,
  });

  return sessionId;
}

export async function getSession(sessionId: string) {
  const session = await db.query.sessions.findFirst({
    where: eq(sessions.id, sessionId),
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await deleteSession(sessionId);
    }
    return null;
  }

  return session;
}

export async function refreshSession(sessionId: string): Promise<boolean> {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await db
    .update(sessions)
    .set({ expiresAt })
    .where(eq(sessions.id, sessionId));

  return true;
}

export async function deleteSession(sessionId: string) {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getSessionFromCookie() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionId) return null;
  return getSession(sessionId);
}

export async function getSessionAndRefresh(): Promise<{
  session: Awaited<ReturnType<typeof getSession>>;
  refreshed: boolean;
}> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionId) return { session: null, refreshed: false };

  const session = await getSession(sessionId);
  if (!session) return { session: null, refreshed: false };

  // Only refresh if more than 1 day has passed to avoid excessive DB writes
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const timeUntilExpiry = session.expiresAt.getTime() - Date.now();
  
  if (SESSION_DURATION_MS - timeUntilExpiry > ONE_DAY_MS) {
    const refreshed = await refreshSession(sessionId);
    if (refreshed) {
      cookieStore.set(SESSION_COOKIE_NAME, sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: SESSION_DURATION_MS / 1000,
      });
    }
    return { session, refreshed: true };
  }

  return { session, refreshed: false };
}

export async function cleanupExpiredSessions(): Promise<number> {
  const result = await db.delete(sessions).where(lt(sessions.expiresAt, new Date())).returning({ id: sessions.id });
  return result.length;
}
