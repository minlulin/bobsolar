import { type NextRequest, NextResponse } from "next/server";

/**
 * CSRF protection middleware.
 *
 * For state-changing requests (POST, PUT, DELETE, PATCH), validates the
 * `Origin` or `Referer` header against the expected origin. This prevents
 * cross-site request forgery attacks from malicious origins.
 *
 * Safe methods (GET, HEAD, OPTIONS) pass through without checks.
 *
 * The expected origin is derived from the request URL in production, or
 * allows localhost in development.
 */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Extract the origin from the Origin or Referer header. */
function getOriginFromHeader(req: NextRequest): string | null {
  const origin = req.headers.get("origin");
  if (origin) return origin;

  const referer = req.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch {
      return null;
    }
  }
  return null;
}

/** Determine the expected origin from the request URL. */
function getExpectedOrigin(req: NextRequest): string {
  return req.nextUrl.origin;
}

/** Check whether the request origin matches the expected origin. */
function isSameOrigin(req: NextRequest): boolean {
  const requestOrigin = getOriginFromHeader(req);
  if (!requestOrigin) {
    return false;
  }
  return requestOrigin === getExpectedOrigin(req);
}

/**
 * Wrap a route handler with CSRF protection.
 *
 * Usage in route.ts:
 *   export const POST = withCsrf(async (req) => { ... });
 *
 * Safe methods (GET, HEAD, OPTIONS) bypass the check.
 * In development (localhost), the check is relaxed but logged.
 */
export function withCsrf(
  handler: (req: NextRequest) => Promise<Response> | Response,
): (req: NextRequest) => Promise<Response> {
  return async (req: NextRequest): Promise<Response> => {
    // Skip CSRF check for safe methods
    if (SAFE_METHODS.has(req.method)) {
      return handler(req);
    }

    // In development, relax the check but log for visibility
    if (process.env.NODE_ENV !== "production") {
      if (!isSameOrigin(req)) {
        console.warn(
          `[CSRF] Non-production request with mismatched/missing origin: ${req.method} ${req.nextUrl.pathname}`,
        );
      }
      return handler(req);
    }

    // Production: require a matching origin header
    const requestOrigin = getOriginFromHeader(req);
    if (!requestOrigin) {
      // No origin/referer header present — could be a privacy-mode browser or proxy.
      // In production, fail closed for state-changing requests.
      return NextResponse.json({ error: "Forbidden: missing origin" }, { status: 403 });
    }

    if (!isSameOrigin(req)) {
      return NextResponse.json({ error: "Forbidden: invalid origin" }, { status: 403 });
    }

    return handler(req);
  };
}
