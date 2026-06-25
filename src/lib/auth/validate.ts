import { redirect } from "next/navigation";
import { cache } from "react";
import type { UserRole } from "@/lib/db/schema";
import { userRoleSchema } from "@/lib/domain/user-roles";
import { getCurrentUserFromDb, getSessionAndRefresh } from "./session";

export interface AuthUser {
  userId: string;
  role: UserRole;
}

/**
 * Access policy (current role model):
 * - admin: full access, including partner management (add/remove owners)
 * - owner: shared-partner access to all operational screens
 *
 * Use `requireAdmin()` for partner-management features.
 * Use `requireOwner()` for operational screens (finance, suppliers, etc.).
 */
const OPERATIONAL_ROLES: ReadonlySet<UserRole> = new Set(["admin", "owner"]);

/**
 * Resolve the current authenticated user, deduped across the React Server
 * render tree. `cache()` memoises within a single request.
 *
 * Auth pipeline:
 *   1. Unseal the session cookie (cheap; iron-session 8 stateless).
 *   2. Hit the DB once to compare `sv` (revocation check) and read the
 *      *authoritative* role (admin status can change while a session is
 *      open) and `archivedAt` (soft-archived users cannot log in).
 *
 * Returns null if ANY of: no cookie, malformed cookie, expired, sv mismatch,
 * user missing, or user is soft-archived.
 */
const resolveCurrentAuth = cache(async (): Promise<AuthUser | null> => {
  const session = await getSessionAndRefresh();
  if (!session) return null;

  const dbUser = await getCurrentUserFromDb(session.userId);
  if (!dbUser) return null;

  if (dbUser.archivedAt !== null) return null;

  // Cookie is stale (password changed, owner archived, etc.) — treat as logged out.
  if (dbUser.sessionVersion !== session.sv) return null;

  const parsedRole = userRoleSchema.safeParse(dbUser.role);
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

/**
 * Gate for any operational action (finance, suppliers, purchases, etc.).
 * All three of the previous role-specific helpers collapsed into a single
 * check: any authenticated user with role admin or owner may proceed.
 * Use `requireAdmin()` for partner-management features.
 */
export async function requireOwner(): Promise<AuthUser> {
  const auth = await requireAuth();
  if (!OPERATIONAL_ROLES.has(auth.role)) {
    redirect("/unauthorized");
  }
  return auth;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  return resolveCurrentAuth();
}
