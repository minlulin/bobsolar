import { redirect } from 'next/navigation';
import { getSessionFromCookie } from './session';

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

  return {
    userId: session.userId,
    role: session.role as UserRole,
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

  return {
    userId: session.userId,
    role: session.role as UserRole,
  };
}
