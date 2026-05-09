'use server';

import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { loginSchema, type LoginInput } from '@/lib/validators/auth';
import { verifyPassword } from '@/lib/auth/password';
import { createSession, deleteSession, getSessionFromCookie } from '@/lib/auth/session';

export async function login(data: LoginInput) {
  const result = loginSchema.safeParse(data);

  if (!result.success) {
    return { success: false, error: 'Invalid input' };
  }

  const { email, password } = result.data;

  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (!user) {
    return { success: false, error: 'Invalid credentials' };
  }

  const isValid = await verifyPassword(password, user.passwordHash);

  if (!isValid) {
    return { success: false, error: 'Invalid credentials' };
  }

  await createSession(user.id, user.role);

  redirect('/');
}

export async function logout() {
  const session = await getSessionFromCookie();
  if (session) {
    await deleteSession(session.id);
  }
  redirect('/login');
}
