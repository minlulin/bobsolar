import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login', '/api'];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if it's a public path
  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Check for session cookie existence
  const sessionId = request.cookies.get('session_id')?.value;

  if (!sessionId) {
    const loginUrl = new URL('/login', request.url);
    // loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - icons (PWA icons)
     * - fonts (self-hosted fonts)
     */
    '/((?!_next/static|_next/image|favicon.ico|icons|fonts).*)',
  ],
};
