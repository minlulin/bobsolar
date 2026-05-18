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
import { users } from "@/lib/db/schema";
import { userRoleSchema } from "@/lib/domain/enums";
import { type ActionResponse, errorResponse, successResponse } from "@/lib/utils/action-response";
import { type LoginInput, loginSchema } from "@/lib/validators/auth";

export async function login(data: LoginInput): Promise<ActionResponse<null>> {
  const result = loginSchema.safeParse(data);

  if (!result.success) {
    return errorResponse("Invalid input");
  }

  const { email, password } = result.data;

  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  // Uniform timing: always verify password even if user not found (mitigates timing attacks)
  const dummyHash =
    "00000000000000000000000000000000:00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
  const hashToVerify = user?.passwordHash ?? dummyHash;
  const isValid = await verifyPassword(password, hashToVerify);

  if (!user || !isValid) {
    return errorResponse("Invalid credentials");
  }

  try {
    const parsedRole = userRoleSchema.parse(user.role);
    await createSession(user.id, parsedRole);
  } catch (error) {
    console.error("[login.createSession]", error);
    return errorResponse(
      "Authentication service misconfigured. Please verify SESSION_SECRET and session settings.",
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
  redirect("/login");
}

export async function changePassword(formData: FormData): Promise<ActionResponse<null>> {
  const session = await getSessionFromCookie();
  if (!session) return errorResponse("Unauthorized");

  const currentPassword = formData.get("currentPassword") as string;
  const newPassword = formData.get("newPassword") as string;

  if (!currentPassword || !newPassword || newPassword.length < 8) {
    return errorResponse("Invalid input");
  }

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
