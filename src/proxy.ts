import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

/**
 * Thin proxy.ts (Next.js 16). Renamed from `middleware.ts`.
 *
 * Responsibilities (and only these):
 *   1. If a dashboard path is hit without a session cookie, redirect to
 *      /login (cheap optimistic check; the (dashboard) layout still does
 *      the real auth via `requireAuth`).
 *   2. If /login is hit with a session cookie present, redirect to /.
 *
 * What this file does NOT do:
 *   - Decrypt the session cookie (no iron-session unseal, no PBKDF2).
 *   - Hit the database.
 *   - Enforce role-based access (requireAdmin / requireOwner).
 *   - Set or clear cookies (forbidden in Next 16 proxy in some contexts).
 *
 * Defense in depth: layouts + server actions + API routes are the real
 * auth gate. This proxy only provides a fast 307 redirect before render.
 *
 * Reference: https://nextjs.org/docs/app/api-reference/file-conventions/proxy
 */

// Routes that require an authenticated session. Mirrors the (dashboard) group
// under src/app/(dashboard)/. Kept as an explicit list (not a glob) so we
// never accidentally gate a future public route.
const DASHBOARD_PREFIXES = [
  "/customers",
  "/finance",
  "/inventory",
  "/owner-portal",
  "/projects",
  "/purchases",
  "/quotations",
  "/settings",
  "/suppliers",
  "/vouchers",
  "/warranty",
] as const;

// Auth-group pages. Authed users hitting these get bounced to /.
const AUTH_ROUTES = ["/login"] as const;

function isDashboardPath(pathname: string): boolean {
  return DASHBOARD_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = request.cookies.has(SESSION_COOKIE_NAME);

  if (isDashboardPath(pathname) && !hasSessionCookie) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthRoute(pathname) && hasSessionCookie) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  /**
   * Negative-lookahead matcher. Runs on every non-asset, non-API request:
   *   - Excludes /api/* (route handlers self-auth; proxy would be redundant)
   *   - Excludes Next.js internals: _next/static, _next/image, _next/data
   *   - Excludes metadata files: favicon.ico, sitemap.xml, robots.txt
   *   - Excludes common static asset extensions
   *
   * Note from Next.js docs: even if `_next/data` is excluded in the matcher,
   * proxy will still run for `_next/data/*` routes. This is intentional and
   * prevents accidental security gaps where a page is protected but the
   * corresponding data route isn't.
   */
  matcher: [
    "/((?!api|_next/static|_next/image|_next/data|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:png|svg|ico|webp|woff2?|css|js)$).*)",
  ],
};
