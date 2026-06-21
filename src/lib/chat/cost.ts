import {
  CHAT_DAILY_COST_ALERT_THRESHOLD_USD,
  CHAT_DAILY_TOKEN_QUOTA,
  CHAT_MAX_MONTHLY_TOKEN_QUOTA,
  CHAT_MODEL_INPUT_COST_PER_MILLION_TOKENS,
  CHAT_MODEL_OUTPUT_COST_PER_MILLION_TOKENS,
} from "@/lib/domain/policies";

/**
 * Cost calculation and quota enforcement for chat usage.
 *
 * All pricing constants are centralized in `src/lib/domain/policies.ts`
 * so that rate changes only require a single edit.
 */

export interface TokenUsage {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
}

export interface CostBreakdown {
  inputCostUsd: number;
  outputCostUsd: number;
  totalCostUsd: number;
}

export interface QuotaStatus {
  dailyTokensUsed: number;
  dailyTokensRemaining: number;
  monthlyTokensUsed: number;
  monthlyTokensRemaining: number;
  dailyCostUsd: number;
  isDailyQuotaExceeded: boolean;
  isMonthlyQuotaExceeded: boolean;
  isCostAlertThresholdExceeded: boolean;
}

/**
 * Compute the USD cost for a single request based on token usage.
 *
 * Pricing is per-million-tokens, so we divide by 1,000,000.
 * Returns 0 for any null token counts (graceful degradation).
 */
export function computeCost(usage: TokenUsage): CostBreakdown {
  const inputTokens = usage.promptTokens ?? 0;
  const outputTokens = usage.completionTokens ?? 0;

  const inputCostUsd = (inputTokens / 1_000_000) * CHAT_MODEL_INPUT_COST_PER_MILLION_TOKENS;
  const outputCostUsd = (outputTokens / 1_000_000) * CHAT_MODEL_OUTPUT_COST_PER_MILLION_TOKENS;

  return {
    inputCostUsd: Math.round(inputCostUsd * 1_000_000) / 1_000_000,
    outputCostUsd: Math.round(outputCostUsd * 1_000_000) / 1_000_000,
    totalCostUsd: Math.round((inputCostUsd + outputCostUsd) * 1_000_000) / 1_000_000,
  };
}

/**
 * Check whether the user has sufficient quota for a request.
 *
 * Returns a `QuotaStatus` with remaining tokens and flags indicating
 * whether any quota or cost threshold has been exceeded.
 */
export function checkQuota(
  dailyTokensUsed: number,
  monthlyTokensUsed: number,
  dailyCostUsd: number,
): QuotaStatus {
  const dailyTokensRemaining = Math.max(0, CHAT_DAILY_TOKEN_QUOTA - dailyTokensUsed);
  const monthlyTokensRemaining = Math.max(0, CHAT_MAX_MONTHLY_TOKEN_QUOTA - monthlyTokensUsed);

  return {
    dailyTokensUsed,
    dailyTokensRemaining,
    monthlyTokensUsed,
    monthlyTokensRemaining,
    dailyCostUsd,
    isDailyQuotaExceeded: dailyTokensUsed >= CHAT_DAILY_TOKEN_QUOTA,
    isMonthlyQuotaExceeded: monthlyTokensUsed >= CHAT_MAX_MONTHLY_TOKEN_QUOTA,
    isCostAlertThresholdExceeded: dailyCostUsd >= CHAT_DAILY_COST_ALERT_THRESHOLD_USD,
  };
}
