import { getIronSession, type SessionOptions } from "iron-session";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Edge proxy (formerly Next.js middleware): rejects requests to protected
 * paths when no session cookie is present. We can't validate the seal
 * here (iron-session needs Node APIs), so the cookie's mere presence is a
 * fast-path filter and the real validation runs inside `requireAuth()` on
 * the server action / page. This adds a centralised "you must have logged
 * in" failsafe so a new route under `(dashboard)/` can't accidentally leak
 * data.
 */

const SESSION_COOKIE_NAME = "bobsolar_session";

type EdgeSession = { sid?: string };

function getProxySessionConfig(): SessionOptions | null {
  const secret = process.env["SESSION_SECRET"];
  if (!secret || secret.trim().length < 32) {
    return null;
  }
  return {
    cookieName: SESSION_COOKIE_NAME,
    password: secret,
    cookieOptions: {
      httpOnly: true,
      secure: process.env["NODE_ENV"] === "production",
      sameSite: "lax",
      path: "/",
    },
  };
}

async function hasValidSession(request: NextRequest): Promise<boolean> {
  const config = getProxySessionConfig();
  if (!config) return false;

  const response = NextResponse.next();
  const session = await getIronSession<EdgeSession>(request, response, config);
  return Boolean(session.sid);
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;
  const isApiRoute = pathname.startsWith("/api/");
  const isAuthed = await hasValidSession(request);

  if (isAuthed) {
    return NextResponse.next();
  }

  if (isApiRoute) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  if (pathname && pathname !== "/") {
    loginUrl.searchParams.set("redirect", `${pathname}${search}`);
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
    "/((?!login|_next/static|_next/image|_next/data|api/auth|icons/|manifest.webmanifest|sw.js|favicon.ico|robots.txt).*)",
  ],
};
