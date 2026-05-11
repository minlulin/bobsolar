'use server';

import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { loginSchema, type LoginInput } from '@/lib/validators/auth';
import { verifyPassword } from '@/lib/auth/password';
import {
  createSession,
  deleteSession,
  getSessionFromCookie,
  revokeAllUserSessions,
} from '@/lib/auth/session';
import type { ActionResponse } from '@/lib/utils/action-response';

// Rate limiting configuration
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour cleanup window
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // opportunistic cleanup (serverless-friendly)

interface RateLimitEntry {
  attempts: number;
  lockedUntil: number | null;
  lastAttempt: number;
}

// In-memory rate limiter (sufficient for 3-person team)
const rateLimitMap = new Map<string, RateLimitEntry>();
let lastCleanupAt = 0;

function maybeCleanupRateLimiter(now: number): void {
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) return;
  lastCleanupAt = now;

  for (const [key, entry] of rateLimitMap.entries()) {
    if (!entry.lockedUntil && now - entry.lastAttempt > RATE_LIMIT_WINDOW_MS) {
      rateLimitMap.delete(key);
      continue;
    }
    if (entry.lockedUntil && now > entry.lockedUntil) {
      rateLimitMap.delete(key);
    }
  }
}

function getRateLimitKey(email: string): string {
  return email.toLowerCase().trim();
}

function isRateLimited(email: string): {
  limited: boolean;
  retryAfter?: number;
} {
  const key = getRateLimitKey(email);
  const entry = rateLimitMap.get(key);

  if (!entry) {
    return { limited: false };
  }

  const now = Date.now();
  maybeCleanupRateLimiter(now);

  // Check if still locked out
  if (entry.lockedUntil && now < entry.lockedUntil) {
    return {
      limited: true,
      retryAfter: Math.ceil((entry.lockedUntil - now) / 1000),
    };
  }

  // Clear expired lockout
  if (entry.lockedUntil && now >= entry.lockedUntil) {
    entry.lockedUntil = null;
    entry.attempts = 0;
  }

  return { limited: false };
}

function recordFailedAttempt(email: string): void {
  const key = getRateLimitKey(email);
  const now = Date.now();
  maybeCleanupRateLimiter(now);
  const entry = rateLimitMap.get(key);

  if (!entry) {
    rateLimitMap.set(key, {
      attempts: 1,
      lockedUntil: null,
      lastAttempt: now,
    });
    return;
  }

  entry.attempts += 1;
  entry.lastAttempt = now;

  if (entry.attempts >= MAX_FAILED_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_DURATION_MS;
  }
}

function clearFailedAttempts(email: string): void {
  const key = getRateLimitKey(email);
  rateLimitMap.delete(key);
}

export async function login(data: LoginInput): Promise<ActionResponse<void>> {
  const result = loginSchema.safeParse(data);

  if (!result.success) {
    return { success: false, error: 'Invalid input' };
  }

  const { email, password } = result.data;

  // Check rate limit before any DB lookup
  const rateLimitCheck = isRateLimited(email);
  if (rateLimitCheck.limited) {
    const minutes = Math.ceil((rateLimitCheck.retryAfter ?? 0) / 60);
    return {
      success: false,
      error: `Too many failed attempts. Please try again in ${minutes} minute${minutes > 1 ? 's' : ''}.`,
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
    recordFailedAttempt(email);
    return { success: false, error: 'Invalid credentials' };
  }

  // Success - clear failed attempts and create session
  clearFailedAttempts(email);
  await createSession(user.id, user.role);

  return { success: true, data: undefined };
}

export async function logout(): Promise<never> {
  const session = await getSessionFromCookie();
  if (session) {
    await deleteSession(session.id);
  }
  redirect('/login');
}

export async function changePassword(
  formData: FormData,
): Promise<ActionResponse<void>> {
  const session = await getSessionFromCookie();
  if (!session) return { success: false, error: 'Unauthorized' };

  const currentPassword = formData.get('currentPassword') as string;
  const newPassword = formData.get('newPassword') as string;

  if (!currentPassword || !newPassword || newPassword.length < 8) {
    return { success: false, error: 'Invalid input' };
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
  });

  if (!user) return { success: false, error: 'User not found' };

  const { hashPassword } = await import('@/lib/auth/password');

  const isValid = await verifyPassword(currentPassword, user.passwordHash);
  if (!isValid) return { success: false, error: 'Incorrect current password' };

  const newHash = await hashPassword(newPassword);

  await db
    .update(users)
    .set({ passwordHash: newHash })
    .where(eq(users.id, user.id));

  // Revoke all other sessions for this user (security: force re-login with new password)
  await revokeAllUserSessions(user.id, session.id);

  return { success: true, data: undefined };
}
