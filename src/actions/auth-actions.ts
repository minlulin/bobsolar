'use server';

import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { authRateLimits, users } from '@/lib/db/schema';
import { and, eq, isNull, lt } from 'drizzle-orm';
import { loginSchema, type LoginInput } from '@/lib/validators/auth';
import { verifyPassword } from '@/lib/auth/password';
import {
  clearSessionCookies,
  createSession,
  deleteSession,
  getSessionFromCookie,
  revokeAllUserSessions,
} from '@/lib/auth/session';
import {
  errorResponse,
  successResponse,
  type ActionResponse,
} from '@/lib/utils/action-response';

// Rate limiting configuration
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour tracking window
const RATE_LIMIT_TTL_MS = 24 * 60 * 60 * 1000; // delete stale rows older than 24h

function getRateLimitKey(email: string): string {
  return email.toLowerCase().trim();
}

async function isRateLimited(email: string): Promise<{
  limited: boolean;
  retryAfter?: number;
}> {
  const key = getRateLimitKey(email);
  const entry = await db.query.authRateLimits.findFirst({
    where: eq(authRateLimits.key, key),
  });

  if (!entry) {
    return { limited: false };
  }

  const now = new Date();

  // Check if still locked out
  if (entry.lockedUntil && now < entry.lockedUntil) {
    return {
      limited: true,
      retryAfter: Math.ceil(
        (entry.lockedUntil.getTime() - now.getTime()) / 1000,
      ),
    };
  }

  if (entry.lockedUntil && now >= entry.lockedUntil) {
    await db
      .update(authRateLimits)
      .set({
        attempts: 0,
        lockedUntil: null,
        updatedAt: now,
      })
      .where(eq(authRateLimits.key, key));
  }

  return { limited: false };
}

async function recordFailedAttempt(email: string): Promise<void> {
  const key = getRateLimitKey(email);
  const now = new Date();
  const windowStart = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS);

  const entry = await db.query.authRateLimits.findFirst({
    where: eq(authRateLimits.key, key),
  });

  if (!entry) {
    await db.insert(authRateLimits).values({
      key,
      attempts: 1,
      lockedUntil: null,
      lastAttemptAt: now,
      updatedAt: now,
    });
    return;
  }

  const baseAttempts = entry.lastAttemptAt < windowStart ? 0 : entry.attempts;
  const attempts = baseAttempts + 1;
  const lockedUntil =
    attempts >= MAX_FAILED_ATTEMPTS
      ? new Date(now.getTime() + LOCKOUT_DURATION_MS)
      : null;

  await db
    .update(authRateLimits)
    .set({
      attempts,
      lockedUntil,
      lastAttemptAt: now,
      updatedAt: now,
    })
    .where(eq(authRateLimits.key, key));

  const staleBefore = new Date(now.getTime() - RATE_LIMIT_TTL_MS);
  await db
    .delete(authRateLimits)
    .where(
      and(
        isNull(authRateLimits.lockedUntil),
        lt(authRateLimits.lastAttemptAt, staleBefore),
      ),
    );
}

async function clearFailedAttempts(email: string): Promise<void> {
  const key = getRateLimitKey(email);
  await db.delete(authRateLimits).where(eq(authRateLimits.key, key));
}

export async function login(data: LoginInput): Promise<ActionResponse<null>> {
  const result = loginSchema.safeParse(data);

  if (!result.success) {
    return errorResponse('Invalid input');
  }

  const { email, password } = result.data;

  // Check rate limit before any DB lookup
  const rateLimitCheck = await isRateLimited(email);
  if (rateLimitCheck.limited) {
    const minutes = Math.ceil((rateLimitCheck.retryAfter ?? 0) / 60);
    return {
      ...errorResponse(
        `Too many failed attempts. Please try again in ${minutes} minute${minutes > 1 ? 's' : ''}.`,
      ),
    };
  }

  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  // Uniform timing: always verify password even if user not found (mitigates timing attacks)
  const dummyHash =
    '$2a$10$00000000000000000000000000000000000000000000000000000000000000';
  const hashToVerify = user?.passwordHash ?? dummyHash;
  const isValid = await verifyPassword(password, hashToVerify);

  if (!user || !isValid) {
    await recordFailedAttempt(email);
    return errorResponse('Invalid credentials');
  }

  // Success - clear failed attempts and create session
  await clearFailedAttempts(email);
  try {
    await createSession(user.id, user.role);
  } catch (error) {
    console.error('[login.createSession]', error);
    return errorResponse(
      'Authentication service misconfigured. Please verify SESSION_SECRET and session settings.',
    );
  }

  return successResponse(null);
}

export async function logout(): Promise<never> {
  const session = await getSessionFromCookie();
  if (session) {
    await deleteSession(session.id);
  }
  await clearSessionCookies();
  redirect('/login');
}

export async function changePassword(
  formData: FormData,
): Promise<ActionResponse<null>> {
  const session = await getSessionFromCookie();
  if (!session) return errorResponse('Unauthorized');

  const currentPassword = formData.get('currentPassword') as string;
  const newPassword = formData.get('newPassword') as string;

  if (!currentPassword || !newPassword || newPassword.length < 8) {
    return errorResponse('Invalid input');
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
  });

  if (!user) return errorResponse('User not found');

  const { hashPassword } = await import('@/lib/auth/password');

  const isValid = await verifyPassword(currentPassword, user.passwordHash);
  if (!isValid) return errorResponse('Incorrect current password');

  const newHash = await hashPassword(newPassword);

  await db
    .update(users)
    .set({ passwordHash: newHash })
    .where(eq(users.id, user.id));

  // Revoke all other sessions for this user (security: force re-login with new password)
  await revokeAllUserSessions(user.id, session.id);

  return successResponse(null);
}
