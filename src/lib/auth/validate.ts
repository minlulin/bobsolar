import { redirect } from "next/navigation";
import { cache } from "react";
import type { UserRole } from "@/lib/db/schema";
import { userRoleSchema } from "@/lib/domain/user-roles";
import { getSessionFromCookie, getUserRoleFromDb } from "./session";

export interface AuthUser {
  userId: string;
  role: UserRole;
}

/**
 * Access policy (current role model):
 * - admin: full access
 * - staff: finance read/write operational access
 */
const FINANCE_ACCESS_ROLES: ReadonlySet<UserRole> = new Set(["admin", "staff"]);

/**
 * Resolve the current authenticated user, deduped across the React Server
 * render tree. `cache()` memoises within a single request, so a page that
 * calls `requireAuth()` from a layout AND from a server action during the
 * same render only runs the cookie-decrypt + DB-role lookup once.
 */
const resolveCurrentAuth = cache(async (): Promise<AuthUser | null> => {
  const session = await getSessionFromCookie();
  if (!session) return null;

  const currentRole = await getUserRoleFromDb(session.userId);
  if (!currentRole) return null;

  const parsedRole = userRoleSchema.safeParse(currentRole);
  if (!parsedRole.success) return null;

  return {
    userId: session.userId,
    role: parsedRole.data,
  };
});

export async function requireAuth(): Promise<AuthUser> {
  const auth = await resolveCurrentAuth();
  if (!auth) {
    redirect("/login");
  }
  return auth;
}

export async function requireAdmin(): Promise<AuthUser> {
  const auth = await requireAuth();
  if (auth.role !== "admin") {
    redirect("/unauthorized");
  }
  return auth;
}

export async function requireFinanceAccess(): Promise<AuthUser> {
  const auth = await requireAuth();
  if (!FINANCE_ACCESS_ROLES.has(auth.role)) {
    redirect("/unauthorized");
  }
  return auth;
}

export async function requireSupplierManagementAccess(): Promise<AuthUser> {
  return requireAdmin();
}

export async function requirePurchaseManagementAccess(): Promise<AuthUser> {
  return requireAdmin();
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  return resolveCurrentAuth();
}
