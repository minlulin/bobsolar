import { redirect } from 'next/navigation';
import { getSessionFromCookie } from '@/lib/auth/session';

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionFromCookie();

  if (session) {
    redirect('/');
  }

  return <div className="min-h-screen">{children}</div>;
}
