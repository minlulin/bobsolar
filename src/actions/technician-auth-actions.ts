"use server";

import { eq, sql } from "drizzle-orm";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { authRateLimits, users } from "@/lib/db/schema";
import {
  AUTH_ATTEMPT_WINDOW_MS,
  AUTH_LOCK_MS,
  AUTH_MAX_ATTEMPTS,
  AUTH_MIN_RESPONSE_MS,
} from "@/lib/domain/policies";
import { type ActionResponse, errorResponse, successResponse } from "@/lib/utils/action-response";
import { type TechnicianLoginInput, technicianLoginSchema } from "@/lib/validators/auth";

async function applyMinAuthDelay(startMs: number): Promise<void> {
  const elapsed = Date.now() - startMs;
  if (elapsed >= AUTH_MIN_RESPONSE_MS) return;
  await new Promise<void>((resolve) => {
    setTimeout(resolve, AUTH_MIN_RESPONSE_MS - elapsed);
  });
}

/**
 * Technician login action.
 *
 * Technicians log in with their name and a simple PIN (stored as password_hash).
 * The name is matched case-insensitively against the user's name field using
 * a direct ILIKE predicate. Only users with the "technician" role can log in
 * via this flow.
 *
 * Rate limiting reuses the shared `authRateLimits` table with a per-name key,
 * applying the same lockout window and max-attempts policy as the normal
 * admin/owner login path.
 */
export async function technicianLogin(data: TechnicianLoginInput): Promise<ActionResponse<null>> {
  const authStartMs = Date.now();
  const result = technicianLoginSchema.safeParse(data);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    return errorResponse(firstIssue?.message ?? "Invalid input");
  }

  const { name, pin } = result.data;
  const normalizedName = name.trim().toLowerCase();
  const rateKey = `technician:${normalizedName}`;
  const now = new Date();
  const windowStart = new Date(now.getTime() - AUTH_ATTEMPT_WINDOW_MS);

  // Check existing lockout before doing any DB work
  const existingLimit = await db.query.authRateLimits.findFirst({
    where: eq(authRateLimits.key, rateKey),
  });

  if (existingLimit?.lockedUntil && existingLimit.lockedUntil > now) {
    await applyMinAuthDelay(authStartMs);
    return errorResponse("Too many login attempts. Please wait before retrying.");
  }

  // Direct case-insensitive lookup — avoids fetching every technician
  const technician = await db.query.users.findFirst({
    where: sql`${users.role} = 'technician' AND lower(${users.name}) = ${normalizedName} AND ${users.archivedAt} IS NULL`,
    columns: {
      id: true,
      name: true,
      role: true,
      passwordHash: true,
      sessionVersion: true,
      archivedAt: true,
    },
  });

  // Uniform timing: always verify a hash even if no technician found
  // (mitigates timing-based user enumeration)
  const dummyHash =
    "00000000000000000000000000000000:00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
  const hashToVerify = technician?.passwordHash ?? dummyHash;
  const isValid = await verifyPassword(pin, hashToVerify);

  if (!technician || !isValid) {
    // Reuse the same atomic upsert pattern as normal login
    const [updated] = await db
      .insert(authRateLimits)
      .values({
        key: rateKey,
        attempts: 1,
        lastAttemptAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: authRateLimits.key,
        set: {
          attempts: sql`CASE WHEN ${authRateLimits.lastAttemptAt} < ${windowStart} THEN 1 ELSE ${authRateLimits.attempts} + 1 END`,
          lastAttemptAt: now,
          updatedAt: now,
          lockedUntil: sql`CASE WHEN ${authRateLimits.lockedUntil} > ${now} THEN ${authRateLimits.lockedUntil} ELSE NULL END`,
        },
        where: sql`${authRateLimits.lastAttemptAt} < ${windowStart} OR ${authRateLimits.lockedUntil} <= ${now} OR ${authRateLimits.lockedUntil} IS NULL`,
      })
      .returning();

    let limitRow = updated;
    if (!limitRow) {
      limitRow = await db.query.authRateLimits.findFirst({
        where: eq(authRateLimits.key, rateKey),
      });
    }

    if (limitRow?.lockedUntil && limitRow.lockedUntil > now) {
      await applyMinAuthDelay(authStartMs);
      return errorResponse("Too many login attempts. Please wait before retrying.");
    }

    if (limitRow && limitRow.attempts >= AUTH_MAX_ATTEMPTS) {
      await db
        .update(authRateLimits)
        .set({
          lockedUntil: new Date(now.getTime() + AUTH_LOCK_MS),
          updatedAt: now,
        })
        .where(eq(authRateLimits.key, rateKey));
    }

    await applyMinAuthDelay(authStartMs);
    return errorResponse("Invalid name or PIN");
  }

  // Create session
  try {
    await createSession(technician.id, technician.role, technician.sessionVersion);
  } catch (error) {
    console.error("[technicianLogin.createSession]", error);
    return errorResponse(
      "Authentication service misconfigured. Please contact your administrator.",
    );
  }

  // Reset rate limit on successful login
  await db.delete(authRateLimits).where(eq(authRateLimits.key, rateKey));

  return successResponse(null);
}
