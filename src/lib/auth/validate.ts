import { redirect } from 'next/navigation';
import { getSessionFromCookie, getUserRoleFromDb } from './session';

export type UserRole = 'admin' | 'staff';

export interface AuthUser {
  userId: string;
  role: UserRole;
}

export async function requireAuth(): Promise<AuthUser> {
  const session = await getSessionFromCookie();

  if (!session) {
    redirect('/login');
  }

  // Read role from users table (single source of truth) - session.role may be stale
  const currentRole = await getUserRoleFromDb(session.userId);

  if (!currentRole) {
    redirect('/login');
  }

  return {
    userId: session.userId,
    role: currentRole as UserRole,
  };
}

export async function requireAdmin(): Promise<AuthUser> {
  const auth = await requireAuth();

  if (auth.role !== 'admin') {
    redirect('/');
  }

  return auth;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const session = await getSessionFromCookie();

  if (!session) {
    return null;
  }

  // Read role from users table (single source of truth) - session.role may be stale
  const currentRole = await getUserRoleFromDb(session.userId);

  if (!currentRole) {
    return null;
  }

  return {
    userId: session.userId,
    role: currentRole as UserRole,
  };
}
