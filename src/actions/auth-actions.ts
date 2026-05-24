"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { verifyPassword } from "@/lib/auth/password";
import {
  clearSessionCookies,
  createSession,
  deleteSession,
  getSessionFromCookie,
  revokeAllUserSessions,
} from "@/lib/auth/session";
import { db } from "@/lib/db";
import { authRateLimits, users } from "@/lib/db/schema";

import { type ActionResponse, errorResponse, successResponse } from "@/lib/utils/action-response";
import { changePasswordSchema, type LoginInput, loginSchema } from "@/lib/validators/auth";

const AUTH_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const AUTH_MAX_ATTEMPTS = 5;
const AUTH_LOCK_MS = 15 * 60 * 1000;
const AUTH_MIN_RESPONSE_MS = 120;

async function applyMinAuthDelay(startMs: number): Promise<void> {
  const elapsed = Date.now() - startMs;
  if (elapsed >= AUTH_MIN_RESPONSE_MS) return;
  await new Promise<void>((resolve) => {
    setTimeout(resolve, AUTH_MIN_RESPONSE_MS - elapsed);
  });
}

export async function login(data: LoginInput): Promise<ActionResponse<null>> {
  const authStartMs = Date.now();
  const result = loginSchema.safeParse(data);

  if (!result.success) {
    return errorResponse("Invalid input");
  }

  const { password } = result.data;
  const email = result.data.email.trim().toLowerCase();
  const rateKey = `login:${email}`;
  const now = new Date();
  const windowStart = new Date(now.getTime() - AUTH_ATTEMPT_WINDOW_MS);

  const limitRow = await db.query.authRateLimits.findFirst({
    where: eq(authRateLimits.key, rateKey),
  });

  if (limitRow?.lockedUntil && limitRow.lockedUntil > now) {
    return errorResponse("Too many login attempts. Please wait before retrying.");
  }

  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  // Uniform timing: always verify password even if user not found (mitigates timing attacks)
  const dummyHash =
    "00000000000000000000000000000000:00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
  const hashToVerify = user?.passwordHash ?? dummyHash;
  const isValid = await verifyPassword(password, hashToVerify);

  if (!user || !isValid) {
    const isWindowExpired = !limitRow || limitRow.lastAttemptAt < windowStart;
    const attempts = isWindowExpired ? 1 : limitRow.attempts + 1;
    const lockedUntil =
      attempts >= AUTH_MAX_ATTEMPTS ? new Date(now.getTime() + AUTH_LOCK_MS) : null;

    if (limitRow) {
      await db
        .update(authRateLimits)
        .set({
          attempts,
          lockedUntil,
          lastAttemptAt: now,
          updatedAt: now,
        })
        .where(eq(authRateLimits.key, rateKey));
    } else {
      await db.insert(authRateLimits).values({
        key: rateKey,
        attempts: 1,
        lockedUntil: null,
        lastAttemptAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }

    await applyMinAuthDelay(authStartMs);
    return errorResponse("Invalid credentials");
  }

  if (limitRow) {
    await db.delete(authRateLimits).where(eq(authRateLimits.key, rateKey));
  }

  try {
    await createSession(user.id);
  } catch (error) {
    console.error("[login.createSession]", error);
    return errorResponse(
      "Authentication service misconfigured. Please verify SESSION_SECRET and session settings.",
    );
  }

  await applyMinAuthDelay(authStartMs);
  return successResponse(null);
}

export async function logout(): Promise<never> {
  const session = await getSessionFromCookie();
  if (session) {
    await deleteSession(session.id);
  }
  await clearSessionCookies();
  redirect("/login");
}

export async function changePassword(formData: FormData): Promise<ActionResponse<null>> {
  const session = await getSessionFromCookie();
  if (!session) return errorResponse("Unauthorized");

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
  });

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return errorResponse(firstIssue?.message ?? "Invalid input");
  }
  const { currentPassword, newPassword } = parsed.data;

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
  });

  if (!user) return errorResponse("User not found");

  const { hashPassword } = await import("@/lib/auth/password");

  const isValid = await verifyPassword(currentPassword, user.passwordHash);
  if (!isValid) return errorResponse("Incorrect current password");

  const newHash = await hashPassword(newPassword);

  await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, user.id));

  // Revoke all other sessions for this user (security: force re-login with new password)
  await revokeAllUserSessions(user.id, session.id);

  return successResponse(null);
}
