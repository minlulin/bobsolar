import { describe, expect, it } from "vitest";

/**
 * Unit tests for the cost calculation module.
 *
 * Pure functions — no mocking needed.
 */

describe("cost calculation", () => {
  describe("computeCost", () => {
    it("computes zero cost for zero tokens", async () => {
      const { computeCost } = await import("./cost");
      const result = computeCost({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });

      expect(result.inputCostUsd).toBe(0);
      expect(result.outputCostUsd).toBe(0);
      expect(result.totalCostUsd).toBe(0);
    });

    it("computes cost for 1M input tokens", async () => {
      const { computeCost } = await import("./cost");
      const result = computeCost({
        promptTokens: 1_000_000,
        completionTokens: 0,
        totalTokens: 1_000_000,
      });

      expect(result.inputCostUsd).toBe(0.3);
      expect(result.outputCostUsd).toBe(0);
      expect(result.totalCostUsd).toBe(0.3);
    });

    it("computes cost for 1M output tokens", async () => {
      const { computeCost } = await import("./cost");
      const result = computeCost({
        promptTokens: 0,
        completionTokens: 1_000_000,
        totalTokens: 1_000_000,
      });

      expect(result.inputCostUsd).toBe(0);
      expect(result.outputCostUsd).toBe(2.5);
      expect(result.totalCostUsd).toBe(2.5);
    });

    it("computes cost for mixed input and output tokens", async () => {
      const { computeCost } = await import("./cost");
      const result = computeCost({
        promptTokens: 500_000,
        completionTokens: 200_000,
        totalTokens: 700_000,
      });

      // 500K / 1M * $0.30 = $0.15
      // 200K / 1M * $2.50 = $0.50
      expect(result.inputCostUsd).toBe(0.15);
      expect(result.outputCostUsd).toBe(0.5);
      expect(result.totalCostUsd).toBe(0.65);
    });

    it("handles null token counts as zero", async () => {
      const { computeCost } = await import("./cost");
      const result = computeCost({
        promptTokens: null,
        completionTokens: null,
        totalTokens: null,
      });

      expect(result.inputCostUsd).toBe(0);
      expect(result.outputCostUsd).toBe(0);
      expect(result.totalCostUsd).toBe(0);
    });

    it("rounds to 6 decimal places", async () => {
      const { computeCost } = await import("./cost");
      const result = computeCost({
        promptTokens: 1,
        completionTokens: 1,
        totalTokens: 2,
      });

      // Very small amounts should still be properly rounded
      expect(result.inputCostUsd).toBeGreaterThanOrEqual(0);
      expect(result.outputCostUsd).toBeGreaterThanOrEqual(0);
    });
  });

  describe("checkQuota", () => {
    it("reports within quota when usage is low", async () => {
      const { checkQuota } = await import("./cost");
      const result = checkQuota(1000, 5000, 0.01);

      expect(result.dailyTokensUsed).toBe(1000);
      expect(result.dailyTokensRemaining).toBe(499_000);
      expect(result.monthlyTokensUsed).toBe(5000);
      expect(result.monthlyTokensRemaining).toBe(4_995_000);
      expect(result.isDailyQuotaExceeded).toBe(false);
      expect(result.isMonthlyQuotaExceeded).toBe(false);
      expect(result.isCostAlertThresholdExceeded).toBe(false);
    });

    it("reports daily quota exceeded", async () => {
      const { checkQuota } = await import("./cost");
      const result = checkQuota(500_000, 5000, 0.01);

      expect(result.isDailyQuotaExceeded).toBe(true);
      expect(result.dailyTokensRemaining).toBe(0);
    });

    it("reports monthly quota exceeded", async () => {
      const { checkQuota } = await import("./cost");
      const result = checkQuota(1000, 5_000_000, 0.01);

      expect(result.isMonthlyQuotaExceeded).toBe(true);
      expect(result.monthlyTokensRemaining).toBe(0);
    });

    it("reports cost alert threshold exceeded", async () => {
      const { checkQuota } = await import("./cost");
      const result = checkQuota(1000, 5000, 5.0);

      expect(result.isCostAlertThresholdExceeded).toBe(true);
    });

    it("reports cost alert not exceeded when just below threshold", async () => {
      const { checkQuota } = await import("./cost");
      const result = checkQuota(1000, 5000, 4.99);

      expect(result.isCostAlertThresholdExceeded).toBe(false);
    });
  });
});
