import { eq, sql } from "drizzle-orm";
import { sealData, unsealData } from "iron-session";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@/lib/db";
import { type UserRole, users } from "@/lib/db/schema";
import { SESSION_TTL_MS, SESSION_TTL_SECONDS } from "@/lib/domain/policies";

/**
 * Iron-session 8 stateless session.
 *
 * The cookie *is* the source of truth. We seal `{ userId, role, sv, iat, exp }`
 * with iron-session 8 (iron-webcrypto AES-256-GCM, HKDF-derived key from
 * SESSION_SECRET, MAC-protected). The `sv` field is `users.session_version`
 * at seal time. To revoke all sessions for a user, increment that column;
 * stale cookies still unseal, but `requireAuth` rejects them because the
 * `sv` no longer matches.
 *
 * No `sessions` table. No DB lookup on the read path. No PBKDF2 cost on
 * every request.
 */

export const SESSION_COOKIE_NAME = "bobsolar_session";
const LEGACY_SESSION_COOKIE_NAME = "session_id";

/** If a session is more than this far from expiry, re-seal it. */
const SESSION_REFRESH_THRESHOLD_MS = 24 * 60 * 60 * 1000;

export type SealedSession = {
  userId: string;
  role: UserRole;
  /** users.session_version at seal time. Compared in `requireAuth`. */
  sv: number;
  /** Issued-at (ms epoch). */
  iat: number;
  /** Expiry (ms epoch). */
  exp: number;
};

export type CurrentUserFromDb = {
  role: UserRole;
  sessionVersion: number;
  archivedAt: Date | null;
};

function assertSessionSecret(): string {
  const secret = process.env["SESSION_SECRET"];
  if (!secret || secret.trim().length < 32) {
    throw new Error("SESSION_SECRET is not set (or too short). Set a strong secret (>= 32 chars).");
  }
  return secret;
}

/**
 * Validate SESSION_SECRET at app boot. Called from `src/app/layout.tsx`.
 * Only enforces in production — dev can run without it (tests don't care).
 */
export function assertSessionSecretAtStartup(): void {
  if (process.env.NODE_ENV === "production") {
    assertSessionSecret();
  }
}

function getCookieOptions(): {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

async function sealSessionCookie(
  data: Pick<SealedSession, "userId" | "role" | "sv">,
): Promise<string> {
  const now = Date.now();
  const payload: SealedSession = {
    ...data,
    iat: now,
    exp: now + SESSION_TTL_MS,
  };
  return sealData(payload, {
    password: assertSessionSecret(),
    ttl: SESSION_TTL_SECONDS,
  });
}

function isSealedSession(value: unknown): value is SealedSession {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v["userId"] === "string" &&
    (v["role"] === "admin" || v["role"] === "owner") &&
    typeof v["sv"] === "number" &&
    typeof v["iat"] === "number" &&
    typeof v["exp"] === "number"
  );
}

/**
 * Create a sealed session cookie for the given user. No DB write.
 *
 * Callers must pass the *current* `sessionVersion` from the users row at
 * login time (so that future bumps invalidate this cookie).
 */
export async function createSession(
  userId: string,
  role: UserRole,
  sessionVersion: number,
): Promise<void> {
  const sealed = await sealSessionCookie({ userId, role, sv: sessionVersion });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sealed, getCookieOptions());
  // Ensure stale legacy auth cookie cannot be used by old clients/routes.
  cookieStore.delete(LEGACY_SESSION_COOKIE_NAME);
}

/**
 * Read + unseal the session cookie. Does NOT touch the DB.
 *
 * Returns the SealedSession (the values baked in at seal time) or null if
 * the cookie is missing, tampered, malformed, or expired. Callers that need
 * the *authoritative* role / `sessionVersion` / archive status must call
 * `getCurrentUserFromDb(userId)` separately — that's what `requireAuth` does.
 */
export async function getSessionFromCookie(): Promise<SealedSession | null> {
  const cookieStore = await cookies();
  const sealed = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sealed) return null;

  let data: unknown;
  try {
    data = await unsealData<unknown>(sealed, {
      password: assertSessionSecret(),
    });
  } catch {
    return null;
  }

  if (!isSealedSession(data)) return null;
  if (data.exp < Date.now()) return null;
  return data;
}

/**
 * Read the cookie and, if the session is more than
 * SESSION_REFRESH_THRESHOLD_MS away from expiry, re-seal it (sliding window).
 * Returns the current session.
 *
 * Memoised per request via React `cache()` so layouts + server actions that
 * run in the same render tree only do one unseal + one (possible) re-seal.
 */
export const getSessionAndRefresh = cache(async (): Promise<SealedSession | null> => {
  const session = await getSessionFromCookie();
  if (!session) return null;

  const timeUntilExpiry = session.exp - Date.now();
  if (SESSION_TTL_MS - timeUntilExpiry > SESSION_REFRESH_THRESHOLD_MS) {
    const refreshed = await sealSessionCookie({
      userId: session.userId,
      role: session.role,
      sv: session.sv,
    });
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, refreshed, getCookieOptions());
  }

  return session;
});

/** Clear both current and legacy session cookies. Used by `logout`. */
export async function clearSessionCookies(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  cookieStore.delete(LEGACY_SESSION_COOKIE_NAME);
}

/**
 * Invalidate all sessions for a user by bumping their `session_version`.
 * Stale cookies still unseal cleanly; the next `requireAuth` call will see
 * the `sv` mismatch and treat the user as logged out.
 *
 * Returns the new version, or null if the user no longer exists.
 */
export async function bumpUserSessionVersion(userId: string): Promise<number | null> {
  const [row] = await db
    .update(users)
    .set({ sessionVersion: sql`${users.sessionVersion} + 1` })
    .where(eq(users.id, userId))
    .returning({ sessionVersion: users.sessionVersion });
  return row?.sessionVersion ?? null;
}

/**
 * Cached lookup of the *authoritative* user state. Use this from
 * `requireAuth` to compare the cookie's `sv` stamp against the DB and to
 * pick up role / archive changes.
 */
export const getCurrentUserFromDb = cache(
  async (userId: string): Promise<CurrentUserFromDb | null> => {
    const row = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { role: true, sessionVersion: true, archivedAt: true },
    });
    if (!row) return null;
    return {
      role: row.role,
      sessionVersion: row.sessionVersion,
      archivedAt: row.archivedAt,
    };
  },
);
