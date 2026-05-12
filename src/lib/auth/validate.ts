import { redirect } from 'next/navigation';
import { getSessionFromCookie, getUserRoleFromDb } from './session';
import { userRoleSchema, type UserRole } from '@/lib/domain/enums';

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

  const parsedRole = userRoleSchema.safeParse(currentRole);
  if (!parsedRole.success) {
    redirect('/login');
  }

  return {
    userId: session.userId,
    role: parsedRole.data,
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

  const parsedRole = userRoleSchema.safeParse(currentRole);
  if (!parsedRole.success) {
    return null;
  }

  return {
    userId: session.userId,
    role: parsedRole.data,
  };
}
