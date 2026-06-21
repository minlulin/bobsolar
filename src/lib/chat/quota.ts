import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { chatUsageLogs } from "@/lib/db/schema";
import { CHAT_DAILY_TOKEN_QUOTA, CHAT_MAX_MONTHLY_TOKEN_QUOTA } from "@/lib/domain/policies";
import { type CostBreakdown, computeCost } from "./cost";

/**
 * Quota enforcement backed by the database.
 *
 * Aggregates token usage from `chat_usage_logs` over daily and monthly
 * windows to enforce per-user quotas.
 */

export interface UserQuotaInfo {
  dailyTokens: number;
  monthlyTokens: number;
  dailyCostUsd: number;
}

/**
 * Query the database for a user's aggregated token usage and cost
 * over the current day and current month.
 */
export async function getUserQuotaInfo(userId: string): Promise<UserQuotaInfo> {
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [dailyResult, monthlyResult] = await Promise.all([
    db
      .select({
        totalTokens: sql<number>`coalesce(sum(${chatUsageLogs.totalTokens}), 0)`,
        promptTokens: sql<number>`coalesce(sum(${chatUsageLogs.promptTokens}), 0)`,
        completionTokens: sql<number>`coalesce(sum(${chatUsageLogs.completionTokens}), 0)`,
      })
      .from(chatUsageLogs)
      .where(and(eq(chatUsageLogs.userId, userId), gte(chatUsageLogs.createdAt, dayStart))),
    db
      .select({
        totalTokens: sql<number>`coalesce(sum(${chatUsageLogs.totalTokens}), 0)`,
        promptTokens: sql<number>`coalesce(sum(${chatUsageLogs.promptTokens}), 0)`,
        completionTokens: sql<number>`coalesce(sum(${chatUsageLogs.completionTokens}), 0)`,
      })
      .from(chatUsageLogs)
      .where(and(eq(chatUsageLogs.userId, userId), gte(chatUsageLogs.createdAt, monthStart))),
  ]);

  const dailyRow = dailyResult[0];
  const monthlyRow = monthlyResult[0];

  const dailyTokens = dailyRow?.totalTokens ?? 0;
  const monthlyTokens = monthlyRow?.totalTokens ?? 0;

  // Compute cost from the raw token counts for accuracy
  const dailyCost = computeCost({
    promptTokens: dailyRow?.promptTokens ?? 0,
    completionTokens: dailyRow?.completionTokens ?? 0,
    totalTokens: dailyTokens,
  });

  return {
    dailyTokens,
    monthlyTokens,
    dailyCostUsd: dailyCost.totalCostUsd,
  };
}

/**
 * Check whether the user can make a request given their current quota.
 * Returns quota status with remaining tokens and exceeded flags.
 */
export async function checkUserQuota(userId: string): Promise<{
  allowed: boolean;
  dailyTokensRemaining: number;
  monthlyTokensRemaining: number;
  dailyCostUsd: number;
  reason: string | null;
}> {
  const quotaInfo = await getUserQuotaInfo(userId);

  const dailyTokensRemaining = Math.max(0, CHAT_DAILY_TOKEN_QUOTA - quotaInfo.dailyTokens);
  const monthlyTokensRemaining = Math.max(
    0,
    CHAT_MAX_MONTHLY_TOKEN_QUOTA - quotaInfo.monthlyTokens,
  );

  if (quotaInfo.dailyTokens >= CHAT_DAILY_TOKEN_QUOTA) {
    return {
      allowed: false,
      dailyTokensRemaining: 0,
      monthlyTokensRemaining,
      dailyCostUsd: quotaInfo.dailyCostUsd,
      reason: "daily_token_quota_exceeded",
    };
  }

  if (quotaInfo.monthlyTokens >= CHAT_MAX_MONTHLY_TOKEN_QUOTA) {
    return {
      allowed: false,
      dailyTokensRemaining,
      monthlyTokensRemaining: 0,
      dailyCostUsd: quotaInfo.dailyCostUsd,
      reason: "monthly_token_quota_exceeded",
    };
  }

  return {
    allowed: true,
    dailyTokensRemaining,
    monthlyTokensRemaining,
    dailyCostUsd: quotaInfo.dailyCostUsd,
    reason: null,
  };
}

/**
 * Compute the cost for a completed request and return the cost breakdown.
 * Thin wrapper around `computeCost` for consistent import paths.
 */
export function calculateRequestCost(usage: {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
}): CostBreakdown {
  return computeCost(usage);
}
