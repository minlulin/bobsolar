"use server";

import { eq } from "drizzle-orm";
import { verifyPassword } from "@/lib/auth/password";
import { clearSessionCookies, createSession, getSessionFromCookie } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { authRateLimits, users } from "@/lib/db/schema";
import {
  AUTH_ATTEMPT_WINDOW_MS,
  AUTH_LOCK_MS,
  AUTH_MAX_ATTEMPTS,
  AUTH_MIN_RESPONSE_MS,
} from "@/lib/domain/policies";

import { type ActionResponse, errorResponse, successResponse } from "@/lib/utils/action-response";
import { changePasswordSchema, type LoginInput, loginSchema } from "@/lib/validators/auth";

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
    await applyMinAuthDelay(authStartMs);
    return errorResponse("Too many login attempts. Please wait before retrying.");
  }

  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
    columns: {
      id: true,
      role: true,
      passwordHash: true,
      sessionVersion: true,
      archivedAt: true,
    },
  });

  // Uniform timing: always verify password even if user not found (mitigates timing attacks)
  const dummyHash =
    "00000000000000000000000000000000:00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
  const hashToVerify = user?.passwordHash ?? dummyHash;
  const isValid = await verifyPassword(password, hashToVerify);

  if (!user || !isValid || user.archivedAt !== null) {
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
    await createSession(user.id, user.role, user.sessionVersion);
  } catch (error) {
    console.error("[login.createSession]", error);
    return errorResponse(
      "Authentication service misconfigured. Please verify SESSION_SECRET and session settings.",
    );
  }

  await applyMinAuthDelay(authStartMs);
  return successResponse(null);
}

export async function logout(): Promise<ActionResponse<null>> {
  // The cookie is the session. No DB row to delete; just clear the cookie.
  await clearSessionCookies();
  return successResponse(null);
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
    columns: { id: true, passwordHash: true, sessionVersion: true },
  });

  if (!user) return errorResponse("User not found");

  const { hashPassword } = await import("@/lib/auth/password");

  const isValid = await verifyPassword(currentPassword, user.passwordHash);
  if (!isValid) return errorResponse("Incorrect current password");

  const newHash = await hashPassword(newPassword);

  // Bump session_version in the same UPDATE that writes the new password.
  // Both must land atomically; if the password update succeeds but the bump
  // fails, the next request would log the user in with the new password
  // without revoking other devices.
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ passwordHash: newHash, sessionVersion: user.sessionVersion + 1 })
      .where(eq(users.id, user.id));
  });

  return successResponse(null);
}
