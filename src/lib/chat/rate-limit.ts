import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { chatMessages } from "@/lib/db/schema";
import { CHAT_RATE_LIMIT_MAX_REQUESTS, CHAT_RATE_LIMIT_WINDOW_MS } from "@/lib/domain/policies";

/**
 * Chat rate limiter using the database for persistence.
 *
 * Uses a sliding-window counter keyed by userId.  Each call to
 * `checkChatRateLimit` counts accepted user messages within the window and
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
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.userId, userId),
        eq(chatMessages.role, "user"),
        gte(chatMessages.createdAt, windowStart),
      ),
    );

  const count = Number(rows[0]?.count ?? 0);
  const allowed = count < CHAT_RATE_LIMIT_MAX_REQUESTS;
  const remaining = Math.max(0, CHAT_RATE_LIMIT_MAX_REQUESTS - count - (allowed ? 1 : 0));
  const resetAt = new Date(Date.now() + CHAT_RATE_LIMIT_WINDOW_MS);

  return { allowed, remaining, resetAt };
}
