import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { chatUsageLogs } from "@/lib/db/schema";
import { CHAT_IP_THROTTLE_MAX_REQUESTS, CHAT_IP_THROTTLE_WINDOW_MS } from "@/lib/domain/policies";

/**
 * IP-based request throttle for abuse prevention.
 *
 * This is a second layer on top of per-user rate limiting.  It catches
 * cases where an attacker cycles through accounts or sends requests
 * before authentication.  Uses the `chat_usage_logs.ip_address` column
 * for persistence, keeping the implementation database-backed and
 * consistent with the rest of the rate-limiting stack.
 *
 * Note: In production behind a reverse proxy, the real client IP should
 * be forwarded via `X-Forwarded-For`.  The caller is responsible for
 * extracting the correct IP.
 */

export interface IpThrottleResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

/**
 * Check whether the given IP address is within the throttle limit.
 *
 * Counts all chat usage log entries created within the throttle window
 * that match the given IP.  Returns `allowed: false` when the count
 * exceeds `CHAT_IP_THROTTLE_MAX_REQUESTS`.
 */
export async function checkIpThrottle(ipAddress: string): Promise<IpThrottleResult> {
  const windowStart = new Date(Date.now() - CHAT_IP_THROTTLE_WINDOW_MS);

  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(chatUsageLogs)
    .where(and(gte(chatUsageLogs.createdAt, windowStart), eq(chatUsageLogs.ipAddress, ipAddress)));

  const count = rows[0]?.count ?? 0;
  const remaining = Math.max(0, CHAT_IP_THROTTLE_MAX_REQUESTS - count);
  const allowed = count < CHAT_IP_THROTTLE_MAX_REQUESTS;

  return {
    allowed,
    remaining,
    retryAfterMs: allowed ? 0 : CHAT_IP_THROTTLE_WINDOW_MS,
  };
}
