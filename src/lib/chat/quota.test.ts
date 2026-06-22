import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit tests for the user token quota system.
 *
 * Tests the daily/monthly token quota enforcement logic.
 */

const mockDbQuery = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: () => mockDbQuery(),
      })),
    })),
  },
}));

describe("user quota", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    mockDbQuery.mockReset();
  });

  afterEach(() => {
    for (const k of Object.keys(process.env)) {
      if (!(k in originalEnv)) delete process.env[k];
    }
    Object.assign(process.env, originalEnv);
    vi.resetModules();
  });

  describe("getUserQuotaInfo", () => {
    it("returns zero usage for a new user", async () => {
      mockDbQuery
        .mockResolvedValueOnce([{ totalTokens: 0, promptTokens: 0, completionTokens: 0 }]) // daily
        .mockResolvedValueOnce([{ totalTokens: 0, promptTokens: 0, completionTokens: 0 }]); // monthly

      const { getUserQuotaInfo } = await import("./quota");
      const result = await getUserQuotaInfo("user-1");

      expect(result.dailyTokens).toBe(0);
      expect(result.monthlyTokens).toBe(0);
      expect(result.dailyCostUsd).toBe(0);
    });

    it("returns correct token counts for an active user", async () => {
      mockDbQuery
        .mockResolvedValueOnce([
          { totalTokens: 50000, promptTokens: 30000, completionTokens: 20000 },
        ]) // daily
        .mockResolvedValueOnce([
          { totalTokens: 200000, promptTokens: 120000, completionTokens: 80000 },
        ]); // monthly

      const { getUserQuotaInfo } = await import("./quota");
      const result = await getUserQuotaInfo("user-1");

      expect(result.dailyTokens).toBe(50000);
      expect(result.monthlyTokens).toBe(200000);
    });

    it("computes daily cost from token counts", async () => {
      // 100K prompt tokens at $0.30/1M = $0.03
      // 50K completion tokens at $2.50/1M = $0.125
      // Total = $0.155
      mockDbQuery
        .mockResolvedValueOnce([
          { totalTokens: 150000, promptTokens: 100000, completionTokens: 50000 },
        ])
        .mockResolvedValueOnce([
          { totalTokens: 150000, promptTokens: 100000, completionTokens: 50000 },
        ]);

      const { getUserQuotaInfo } = await import("./quota");
      const result = await getUserQuotaInfo("user-1");

      expect(result.dailyCostUsd).toBeCloseTo(0.155, 3);
    });

    it("handles null token counts gracefully", async () => {
      mockDbQuery
        .mockResolvedValueOnce([{ totalTokens: null, promptTokens: null, completionTokens: null }])
        .mockResolvedValueOnce([{ totalTokens: null, promptTokens: null, completionTokens: null }]);

      const { getUserQuotaInfo } = await import("./quota");
      const result = await getUserQuotaInfo("user-1");

      expect(result.dailyTokens).toBe(0);
      expect(result.monthlyTokens).toBe(0);
    });
  });

  describe("checkUserQuota", () => {
    it("allows request when user is within both quotas", async () => {
      mockDbQuery
        .mockResolvedValueOnce([
          { totalTokens: 100000, promptTokens: 60000, completionTokens: 40000 },
        ])
        .mockResolvedValueOnce([
          { totalTokens: 500000, promptTokens: 300000, completionTokens: 200000 },
        ]);

      const { checkUserQuota } = await import("./quota");
      const result = await checkUserQuota("user-1");

      expect(result.allowed).toBe(true);
      expect(result.dailyTokensRemaining).toBe(400000); // 500K - 100K
      expect(result.monthlyTokensRemaining).toBe(4500000); // 5M - 500K
      expect(result.reason).toBeNull();
    });

    it("blocks when daily quota is exceeded", async () => {
      mockDbQuery
        .mockResolvedValueOnce([
          { totalTokens: 500000, promptTokens: 300000, completionTokens: 200000 },
        ])
        .mockResolvedValueOnce([
          { totalTokens: 500000, promptTokens: 300000, completionTokens: 200000 },
        ]);

      const { checkUserQuota } = await import("./quota");
      const result = await checkUserQuota("user-1");

      expect(result.allowed).toBe(false);
      expect(result.dailyTokensRemaining).toBe(0);
      expect(result.reason).toBe("daily_token_quota_exceeded");
    });

    it("blocks when daily quota is exceeded by even 1 token", async () => {
      mockDbQuery
        .mockResolvedValueOnce([
          { totalTokens: 500001, promptTokens: 300000, completionTokens: 200001 },
        ])
        .mockResolvedValueOnce([
          { totalTokens: 500001, promptTokens: 300000, completionTokens: 200001 },
        ]);

      const { checkUserQuota } = await import("./quota");
      const result = await checkUserQuota("user-1");

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("daily_token_quota_exceeded");
    });

    it("blocks when monthly quota is exceeded (but daily is fine)", async () => {
      mockDbQuery
        .mockResolvedValueOnce([
          { totalTokens: 100000, promptTokens: 60000, completionTokens: 40000 },
        ])
        .mockResolvedValueOnce([
          { totalTokens: 5000000, promptTokens: 3000000, completionTokens: 2000000 },
        ]);

      const { checkUserQuota } = await import("./quota");
      const result = await checkUserQuota("user-1");

      expect(result.allowed).toBe(false);
      expect(result.monthlyTokensRemaining).toBe(0);
      expect(result.reason).toBe("monthly_token_quota_exceeded");
    });

    it("daily quota takes priority over monthly when both exceeded", async () => {
      mockDbQuery
        .mockResolvedValueOnce([
          { totalTokens: 500000, promptTokens: 300000, completionTokens: 200000 },
        ])
        .mockResolvedValueOnce([
          { totalTokens: 5000000, promptTokens: 3000000, completionTokens: 2000000 },
        ]);

      const { checkUserQuota } = await import("./quota");
      const result = await checkUserQuota("user-1");

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("daily_token_quota_exceeded");
    });

    it("allows request at exactly 1 token below daily limit", async () => {
      mockDbQuery
        .mockResolvedValueOnce([
          { totalTokens: 499999, promptTokens: 300000, completionTokens: 199999 },
        ])
        .mockResolvedValueOnce([
          { totalTokens: 499999, promptTokens: 300000, completionTokens: 199999 },
        ]);

      const { checkUserQuota } = await import("./quota");
      const result = await checkUserQuota("user-1");

      expect(result.allowed).toBe(true);
      expect(result.dailyTokensRemaining).toBe(1);
    });
  });

  describe("calculateRequestCost", () => {
    it("computes cost correctly for a single request", async () => {
      mockDbQuery
        .mockResolvedValueOnce([{ totalTokens: 0, promptTokens: 0, completionTokens: 0 }])
        .mockResolvedValueOnce([{ totalTokens: 0, promptTokens: 0, completionTokens: 0 }]);

      const { calculateRequestCost } = await import("./quota");
      const result = calculateRequestCost({
        promptTokens: 10000,
        completionTokens: 5000,
        totalTokens: 15000,
      });

      // 10K input / 1M * $0.30 = $0.003
      // 5K output / 1M * $2.50 = $0.0125
      expect(result.inputCostUsd).toBeCloseTo(0.003, 6);
      expect(result.outputCostUsd).toBeCloseTo(0.0125, 6);
      expect(result.totalCostUsd).toBeCloseTo(0.0155, 6);
    });

    it("returns zero cost for null token counts", async () => {
      mockDbQuery
        .mockResolvedValueOnce([{ totalTokens: 0, promptTokens: 0, completionTokens: 0 }])
        .mockResolvedValueOnce([{ totalTokens: 0, promptTokens: 0, completionTokens: 0 }]);

      const { calculateRequestCost } = await import("./quota");
      const result = calculateRequestCost({
        promptTokens: null,
        completionTokens: null,
        totalTokens: null,
      });

      expect(result.inputCostUsd).toBe(0);
      expect(result.outputCostUsd).toBe(0);
      expect(result.totalCostUsd).toBe(0);
    });
  });
});
