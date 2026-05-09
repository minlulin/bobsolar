import { redirect } from 'next/navigation';
import { getSessionFromCookie } from './session';

export async function requireAuth() {
  const session = await getSessionFromCookie();

  if (!session) {
    redirect('/login');
  }

  return {
    userId: session.userId,
    role: session.role as 'admin' | 'staff',
  };
}

export async function requireAdmin() {
  const auth = await requireAuth();

  if (auth.role !== 'admin') {
    redirect('/'); // Or a dedicated unauthorized page
  }

  return auth;
}
