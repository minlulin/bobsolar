import { cookies } from 'next/headers';
import { getIronSession, type SessionOptions } from 'iron-session';
import { db } from '@/lib/db';
import { sessions, users } from '@/lib/db/schema';
import { eq, lt, and, ne } from 'drizzle-orm';
import { SESSION_TTL_MS, SESSION_TTL_SECONDS } from '@/lib/domain/policies';
import { uuidSchema } from '@/lib/validators/common';

const SESSION_COOKIE_NAME = 'bobsolar_session';
const LEGACY_SESSION_COOKIE_NAME = 'session_id';

function assertSessionSecret(): void {
  const secret = process.env['SESSION_SECRET'];
  if (!secret || secret.trim().length < 32) {
    throw new Error(
      'SESSION_SECRET is not set (or too short). Set a strong secret (>= 32 chars).',
    );
  }
}

function getSessionSecretOrPlaceholder(): string {
  // Avoid throwing at module evaluation time (e.g. during `next build`).
  // All session entry points call `assertSessionSecret()` before doing real work.
  const secret = process.env['SESSION_SECRET'];
  return secret && secret.trim().length >= 32
    ? secret
    : 'insecure-placeholder-secret-insecure-placeholder-secret';
}

// Iron-session configuration for encrypted cookies
const ironSessionConfig: SessionOptions = {
  cookieName: SESSION_COOKIE_NAME,
  password: getSessionSecretOrPlaceholder(),
  cookieOptions: {
    httpOnly: true,
    secure: process.env['NODE_ENV'] === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  },
};

// Session data interface for iron-session
type IronSessionData = {
  sid?: string; // sealed session ID
};

function getSessionCookieOptions(): {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax';
  path: '/';
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: process.env['NODE_ENV'] === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  };
}

/** Fetch `Set-Cookie`: `Headers.get('set-cookie')` is often null per spec; Node exposes `getSetCookie`. */
function firstSetCookieLine(res: Response): string | null {
  const headers = res.headers;
  if (typeof headers.getSetCookie === 'function') {
    const lines = headers.getSetCookie();
    return lines[0] ?? null;
  }
  return headers.get('set-cookie');
}

async function sealSession(sessionId: string): Promise<string> {
  // Create a temporary seal using iron-session (must call save() to append Set-Cookie).
  const mockRequest = new Request('http://localhost', {
    headers: { cookie: '' },
  });
  const mockResponse = new Response();

  const session = await getIronSession<IronSessionData>(
    mockRequest,
    mockResponse,
    {
      ...ironSessionConfig,
      password: ironSessionConfig.password,
    },
  );

  session.sid = sessionId;
  await session.save();

  const setCookieHeader = firstSetCookieLine(mockResponse);
  if (!setCookieHeader) {
    throw new Error('Failed to seal session (no Set-Cookie after save)');
  }

  const match = setCookieHeader.match(
    new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`),
  );
  const value = match?.[1];
  if (!value) {
    throw new Error('Failed to parse sealed session cookie');
  }
  return value;
}

async function unsealSession(
  sealedValue: string,
): Promise<IronSessionData | null> {
  try {
    const mockRequest = new Request('http://localhost', {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${sealedValue}`,
      },
    });
    const mockResponse = new Response();

    const session = await getIronSession<IronSessionData>(
      mockRequest,
      mockResponse,
      ironSessionConfig,
    );

    return session.sid ? session : null;
  } catch {
    return null;
  }
}

export async function createSession(
  userId: string,
  role: string,
): Promise<string> {
  assertSessionSecret();
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.insert(sessions).values({
    id: sessionId,
    userId,
    role,
    expiresAt,
  });

  // Seal the session ID using iron-session
  const sealedSession = await sealSession(sessionId);

  const cookieStore = await cookies();
  cookieStore.set(
    SESSION_COOKIE_NAME,
    sealedSession,
    getSessionCookieOptions(),
  );
  // Ensure stale legacy auth cookie cannot be used by old clients/routes.
  cookieStore.delete(LEGACY_SESSION_COOKIE_NAME);

  return sessionId;
}

export async function getSession(
  sessionId: string,
): Promise<typeof sessions.$inferSelect | null> {
  const parsedSessionId = uuidSchema.safeParse(sessionId);
  if (!parsedSessionId.success) {
    return null;
  }

  const session = await db.query.sessions.findFirst({
    where: eq(sessions.id, parsedSessionId.data),
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
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db
    .update(sessions)
    .set({ expiresAt })
    .where(eq(sessions.id, sessionId));

  return true;
}

export async function revokeAllUserSessions(
  userId: string,
  exceptSessionId?: string,
): Promise<number> {
  // Delete all sessions for a user (used on password change)
  const query = exceptSessionId
    ? and(eq(sessions.userId, userId), ne(sessions.id, exceptSessionId))
    : eq(sessions.userId, userId);

  const result = await db.delete(sessions).where(query).returning({
    id: sessions.id,
  });

  return result.length;
}

export async function deleteSession(sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  cookieStore.delete(LEGACY_SESSION_COOKIE_NAME);
}

export async function getUserRoleFromDb(
  userId: string,
): Promise<string | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { role: true },
  });
  return user?.role ?? null;
}

export async function getSessionFromCookie(): Promise<
  typeof sessions.$inferSelect | null
> {
  const { session } = await getSessionAndRefresh();
  return session;
}

export async function getSessionAndRefresh(): Promise<{
  session: typeof sessions.$inferSelect | null;
  refreshed: boolean;
}> {
  const cookieStore = await cookies();
  const sealedValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sealedValue) {
    cookieStore.delete(LEGACY_SESSION_COOKIE_NAME);
    return { session: null, refreshed: false };
  }
  assertSessionSecret();

  // Unseal the session ID from the encrypted cookie
  const unsealed = await unsealSession(sealedValue);
  if (!unsealed?.sid) return { session: null, refreshed: false };

  const session = await getSession(unsealed.sid);
  if (!session) return { session: null, refreshed: false };

  // Only refresh if more than 1 day has passed to avoid excessive DB writes
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const timeUntilExpiry = session.expiresAt.getTime() - Date.now();

  if (SESSION_TTL_MS - timeUntilExpiry > ONE_DAY_MS) {
    const refreshed = await refreshSession(unsealed.sid);
    if (refreshed) {
      // Re-seal and update cookie
      const newSealedSession = await sealSession(unsealed.sid);
      cookieStore.set(
        SESSION_COOKIE_NAME,
        newSealedSession,
        getSessionCookieOptions(),
      );
    }
    return { session, refreshed: true };
  }

  return { session, refreshed: false };
}

export async function cleanupExpiredSessions(): Promise<number> {
  const result = await db
    .delete(sessions)
    .where(lt(sessions.expiresAt, new Date()))
    .returning({ id: sessions.id });
  return result.length;
}

// Export session config for middleware usage if needed
export { ironSessionConfig, SESSION_COOKIE_NAME };
