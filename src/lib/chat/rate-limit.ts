import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { chatUsageLogs } from "@/lib/db/schema";
import { CHAT_RATE_LIMIT_MAX_REQUESTS, CHAT_RATE_LIMIT_WINDOW_MS } from "@/lib/domain/policies";

/**
 * Chat rate limiter using the database for persistence.
 *
 * Uses a sliding-window counter keyed by userId.  Each call to
 * `checkChatRateLimit` counts usage-log entries within the window and
 * returns whether the user is still within their quota.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * Check whether the given user is allowed to send another chat message.
 *
 * Returns `{ allowed: false }` when the per-window quota is exhausted.
 * The `resetAt` timestamp tells the caller when the window expires so
 * they can set `Retry-After` headers.
 */
export async function checkChatRateLimit(userId: string): Promise<RateLimitResult> {
  const windowStart = new Date(Date.now() - CHAT_RATE_LIMIT_WINDOW_MS);

  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(chatUsageLogs)
    .where(and(eq(chatUsageLogs.userId, userId), gte(chatUsageLogs.createdAt, windowStart)));

  const count = rows[0]?.count ?? 0;
  const remaining = Math.max(0, CHAT_RATE_LIMIT_MAX_REQUESTS - count);
  const allowed = count < CHAT_RATE_LIMIT_MAX_REQUESTS;
  const resetAt = new Date(Date.now() + CHAT_RATE_LIMIT_WINDOW_MS);

  return { allowed, remaining, resetAt };
}
