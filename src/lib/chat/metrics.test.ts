import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit tests for the chat metrics module.
 *
 * Tests the in-memory metrics tracking for tokens, costs, latency, errors, and key rotation.
 */

describe("chat metrics", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe("recordChatTokens / getChatMetrics", () => {
    it("records token usage and returns correct snapshot", async () => {
      const metrics = await import("./metrics");

      metrics.recordChatTokens(1000, 500);
      metrics.recordChatTokens(2000, 1000);

      const snapshot = metrics.getChatMetrics();

      expect(snapshot.tokens.daily.totalTokens).toBe(4500); // (1000+500) + (2000+1000)
      expect(snapshot.tokens.daily.promptTokens).toBe(3000);
      expect(snapshot.tokens.daily.completionTokens).toBe(1500);
      expect(snapshot.tokens.daily.requestCount).toBe(2);
    });

    it("mirrors daily tokens to monthly", async () => {
      const metrics = await import("./metrics");

      metrics.recordChatTokens(5000, 2000);

      const snapshot = metrics.getChatMetrics();

      expect(snapshot.tokens.monthly.totalTokens).toBe(7000);
      expect(snapshot.tokens.monthly.promptTokens).toBe(5000);
      expect(snapshot.tokens.monthly.completionTokens).toBe(2000);
      expect(snapshot.tokens.monthly.requestCount).toBe(1);
    });
  });

  describe("recordChatCost", () => {
    it("accumulates cost correctly", async () => {
      const metrics = await import("./metrics");

      metrics.recordChatCost(0.01);
      metrics.recordChatCost(0.02);

      const snapshot = metrics.getChatMetrics();

      expect(snapshot.cost.daily.totalUsd).toBeCloseTo(0.03, 6);
      expect(snapshot.cost.monthly.totalUsd).toBeCloseTo(0.03, 6);
      expect(snapshot.cost.daily.lastUpdated).toBeInstanceOf(Date);
    });
  });

  describe("recordChatLatency", () => {
    it("records latency samples", async () => {
      const metrics = await import("./metrics");

      metrics.recordChatLatency(100);
      metrics.recordChatLatency(200);
      metrics.recordChatLatency(300);

      const snapshot = metrics.getChatMetrics();

      expect(snapshot.latency.avgMs).toBe(200);
      expect(snapshot.latency.sampleCount).toBe(3);
    });

    it("calculates P95 latency", async () => {
      const metrics = await import("./metrics");

      // Add 100 samples: 1, 2, 3, ..., 100
      for (let i = 1; i <= 100; i++) {
        metrics.recordChatLatency(i);
      }

      const snapshot = metrics.getChatMetrics();

      // P95: sorted[Math.floor(100 * 0.95)] = sorted[95] (0-indexed) = 96
      expect(snapshot.latency.p95Ms).toBe(96);
    });

    it("caps latency samples at 100", async () => {
      const metrics = await import("./metrics");

      for (let i = 1; i <= 110; i++) {
        metrics.recordChatLatency(i);
      }

      const snapshot = metrics.getChatMetrics();

      expect(snapshot.latency.sampleCount).toBe(100);
    });

    it("returns 0 for avg and P95 when no samples", async () => {
      const metrics = await import("./metrics");
      const snapshot = metrics.getChatMetrics();

      expect(snapshot.latency.avgMs).toBe(0);
      expect(snapshot.latency.p95Ms).toBe(0);
    });
  });

  describe("recordChatError", () => {
    it("increments error count", async () => {
      const metrics = await import("./metrics");

      metrics.recordChatError("stream_error");
      metrics.recordChatError("timeout");

      const snapshot = metrics.getChatMetrics();

      expect(snapshot.errors.count).toBe(2);
      expect(snapshot.errors.lastError).toBe("timeout");
      expect(snapshot.errors.lastOccurrence).toBeInstanceOf(Date);
    });

    it("truncates error codes to 500 characters", async () => {
      const metrics = await import("./metrics");

      const longError = "x".repeat(600);
      metrics.recordChatError(longError);

      const snapshot = metrics.getChatMetrics();

      expect(snapshot.errors.lastError?.length).toBe(500);
    });
  });

  describe("recordKeyFailover", () => {
    it("tracks key rotation failovers", async () => {
      const metrics = await import("./metrics");

      metrics.recordKeyFailover("primary", "backup-1");
      metrics.recordKeyFailover("backup-1", "backup-2");

      const snapshot = metrics.getChatMetrics();

      expect(snapshot.keyRotation.failoverCount).toBe(2);
      expect(snapshot.keyRotation.lastFailoverFrom).toBe("backup-1");
      expect(snapshot.keyRotation.lastFailoverTo).toBe("backup-2");
      expect(snapshot.keyRotation.lastFailoverAt).toBeInstanceOf(Date);
    });

    it("truncates key labels to 100 characters", async () => {
      const metrics = await import("./metrics");

      const longLabel = "x".repeat(150);
      metrics.recordKeyFailover(longLabel, "target");

      const snapshot = metrics.getChatMetrics();

      expect(snapshot.keyRotation.lastFailoverFrom?.length).toBe(100);
    });
  });

  describe("resetChatMetrics", () => {
    it("resets all metrics to zero", async () => {
      const metrics = await import("./metrics");

      metrics.recordChatTokens(1000, 500);
      metrics.recordChatCost(0.01);
      metrics.recordChatLatency(100);
      metrics.recordChatError("error");
      metrics.recordKeyFailover("a", "b");

      metrics.resetChatMetrics();

      const snapshot = metrics.getChatMetrics();

      expect(snapshot.tokens.daily.totalTokens).toBe(0);
      expect(snapshot.tokens.daily.requestCount).toBe(0);
      expect(snapshot.cost.daily.totalUsd).toBe(0);
      expect(snapshot.latency.sampleCount).toBe(0);
      expect(snapshot.errors.count).toBe(0);
      expect(snapshot.keyRotation.failoverCount).toBe(0);
    });
  });

  describe("getChatMetrics snapshot", () => {
    it("includes collectedAt timestamp", async () => {
      const metrics = await import("./metrics");

      const before = new Date();
      const snapshot = metrics.getChatMetrics();
      const after = new Date();

      const collectedAt = new Date(snapshot.collectedAt);
      expect(collectedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(collectedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it("returns a copy (mutation-safe)", async () => {
      const metrics = await import("./metrics");

      metrics.recordChatTokens(1000, 500);

      const snapshot1 = metrics.getChatMetrics();
      snapshot1.tokens.daily.totalTokens = 99999; // mutate the snapshot

      const snapshot2 = metrics.getChatMetrics();
      expect(snapshot2.tokens.daily.totalTokens).toBe(1500); // original value preserved
    });
  });
});
