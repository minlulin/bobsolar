import { NextResponse, type NextRequest } from 'next/server';

/**
 * Edge proxy (formerly Next.js middleware): rejects requests to protected
 * paths when no session cookie is present. We can't validate the seal
 * here (iron-session needs Node APIs), so the cookie's mere presence is a
 * fast-path filter and the real validation runs inside `requireAuth()` on
 * the server action / page. This adds a centralised "you must have logged
 * in" failsafe so a new route under `(dashboard)/` can't accidentally leak
 * data.
 */

const SESSION_COOKIE_NAME = 'bobsolar_session';

export function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE_NAME);

  if (hasSession) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.search = '';
  if (pathname && pathname !== '/') {
    loginUrl.searchParams.set('redirect', `${pathname}${search}`);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    /*
     * Protect everything EXCEPT:
     * - /login and the auth route group
     * - /_next (static assets, image optimisation)
     * - public assets we explicitly allow
     * - service worker + manifest + favicon
     */
    '/((?!login|_next/static|_next/image|_next/data|api/auth|icons/|manifest.webmanifest|sw.js|favicon.ico|robots.txt).*)',
  ],
};
