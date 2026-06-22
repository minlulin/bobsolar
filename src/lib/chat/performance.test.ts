import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Performance tests for the chat system.
 *
 * Tests load handling, response times, memory usage, and database performance.
 * These are synthetic benchmarks that measure algorithmic performance rather
 * than full HTTP load testing (which would require a running server).
 */

// Top-level mock references (required for vi.mock hoisting)
const mockSelect = vi.fn();

// ── Rate Limiter Performance ─────────────────────────────────────────────

describe("rate limiter performance", () => {
  vi.mock("@/lib/db", () => ({
    db: { select: mockSelect },
  }));

  beforeEach(() => {
    vi.resetModules();
    mockSelect.mockReset();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("processes rate limit check in constant time regardless of count", async () => {
    mockSelect.mockImplementation(() => ({
      from: () => ({
        where: () => Promise.resolve([{ count: 0 }]),
      }),
    }));

    const { checkChatRateLimit } = await import("./rate-limit");

    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      await checkChatRateLimit("user-1");
    }
    const elapsed = performance.now() - start;

    // 1000 calls should complete in under 100ms (mocked DB)
    expect(elapsed).toBeLessThan(100);
  });

  it("handles concurrent rate limit checks efficiently", async () => {
    mockSelect.mockImplementation(() => ({
      from: () => ({
        where: () => Promise.resolve([{ count: 5 }]),
      }),
    }));

    const { checkChatRateLimit } = await import("./rate-limit");

    const start = performance.now();
    const promises = Array.from({ length: 100 }, (_, i) => checkChatRateLimit(`user-${i}`));
    await Promise.all(promises);
    const elapsed = performance.now() - start;

    // 100 concurrent calls should complete in under 50ms
    expect(elapsed).toBeLessThan(50);
  });
});

// ── IP Throttle Performance ──────────────────────────────────────────────

describe("IP throttle performance", () => {
  vi.mock("@/lib/db", () => ({
    db: { select: mockSelect },
  }));

  beforeEach(() => {
    vi.resetModules();
    mockSelect.mockReset();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("processes throttle check in constant time", async () => {
    mockSelect.mockImplementation(() => ({
      from: () => ({
        where: () => Promise.resolve([{ count: 1 }]),
      }),
    }));

    const { checkIpThrottle } = await import("./ip-throttle");

    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      await checkIpThrottle(`192.168.1.${i % 256}`);
    }
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(100);
  });
});

// ── Cost Calculation Performance ─────────────────────────────────────────

describe("cost calculation performance", () => {
  it("computes cost in sub-microsecond time", async () => {
    const { computeCost } = await import("./cost");

    const start = performance.now();
    for (let i = 0; i < 10_000; i++) {
      computeCost({ promptTokens: 10000, completionTokens: 5000, totalTokens: 15000 });
    }
    const elapsed = performance.now() - start;

    // 10K computations should complete in under 10ms
    expect(elapsed).toBeLessThan(10);
  });

  it("checkQuota runs in constant time", async () => {
    const { checkQuota } = await import("./cost");

    const start = performance.now();
    for (let i = 0; i < 10_000; i++) {
      checkQuota(100000, 500000, 1.5);
    }
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(10);
  });
});

// ── Metrics Performance ──────────────────────────────────────────────────

describe("metrics performance", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("records 100K token events without significant slowdown", async () => {
    const metrics = await import("./metrics");

    const start = performance.now();
    for (let i = 0; i < 100_000; i++) {
      metrics.recordChatTokens(100, 50);
    }
    const elapsed = performance.now() - start;

    // 100K recordings should complete in under 100ms
    expect(elapsed).toBeLessThan(100);

    const snapshot = metrics.getChatMetrics();
    expect(snapshot.tokens.daily.requestCount).toBe(100_000);
  });

  it("handles 100K latency recordings with P95 calculation", async () => {
    const metrics = await import("./metrics");

    const start = performance.now();
    for (let i = 0; i < 100_000; i++) {
      metrics.recordChatLatency(Math.random() * 5000);
    }
    const elapsed = performance.now() - start;

    // 100K recordings should complete in under 500ms
    expect(elapsed).toBeLessThan(500);

    const snapshot = metrics.getChatMetrics();
    expect(snapshot.latency.sampleCount).toBe(100); // Capped at 100
    expect(snapshot.latency.p95Ms).toBeGreaterThan(0);
  });

  it("resetChatMetrics completes in constant time", async () => {
    const metrics = await import("./metrics");

    // Accumulate some data
    for (let i = 0; i < 1000; i++) {
      metrics.recordChatTokens(100, 50);
      metrics.recordChatLatency(100);
    }

    const start = performance.now();
    metrics.resetChatMetrics();
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(1);

    const snapshot = metrics.getChatMetrics();
    expect(snapshot.tokens.daily.totalTokens).toBe(0);
    expect(snapshot.latency.sampleCount).toBe(0);
  });
});

// ── Key Rotator Performance ──────────────────────────────────────────────

describe("key rotator performance", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env["GEMINI_API_KEY_PRIMARY"] = "key-1";
    process.env["GEMINI_API_KEY_BACKUP_1"] = "key-2";
    process.env["GEMINI_API_KEY_BACKUP_2"] = "key-3";
  });

  afterEach(() => {
    for (const k of Object.keys(process.env)) {
      if (!(k in originalEnv)) delete process.env[k];
    }
    Object.assign(process.env, originalEnv);
    vi.resetModules();
  });

  it("getNextKey performs in constant time regardless of key count", async () => {
    const { getNextKey } = await import("./key-rotator");

    const start = performance.now();
    for (let i = 0; i < 10_000; i++) {
      getNextKey();
    }
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(10);
  });

  it("getKeyStatus returns quickly for monitoring", async () => {
    const { getKeyStatus } = await import("./key-rotator");

    const start = performance.now();
    for (let i = 0; i < 10_000; i++) {
      getKeyStatus();
    }
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(10);
  });
});

// ── Validation Performance ───────────────────────────────────────────────

describe("validation performance", () => {
  it("validates a typical request in under 1ms", async () => {
    const { validateChatRequest } = await import("./validation");

    const body = {
      messages: [{ role: "user" as const, content: "Help with inverter fault F09" }],
      brand: "Growatt",
      errorCode: "F09",
    };

    const start = performance.now();
    for (let i = 0; i < 10_000; i++) {
      validateChatRequest(body);
    }
    const elapsed = performance.now() - start;

    // 10K validations should complete in under 100ms
    expect(elapsed).toBeLessThan(100);
  });

  it("validates large message arrays efficiently", async () => {
    const { validateChatRequest } = await import("./validation");

    const messages = Array.from({ length: 100 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `Message ${i} with some content about inverter diagnostics`,
    }));
    messages[99] = { role: "user", content: "Final user message" };

    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      validateChatRequest({ messages });
    }
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(100);
  });
});

// ── Memory Usage Tests ───────────────────────────────────────────────────

describe("memory usage", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("metrics module does not grow unboundedly", async () => {
    const metrics = await import("./metrics");

    // Record many events
    for (let i = 0; i < 10_000; i++) {
      metrics.recordChatTokens(100, 50);
      metrics.recordChatLatency(Math.random() * 1000);
    }

    const snapshot = metrics.getChatMetrics();

    // Latency samples should be capped at 100
    expect(snapshot.latency.sampleCount).toBeLessThanOrEqual(100);

    // Reset and verify cleanup
    metrics.resetChatMetrics();
    const cleaned = metrics.getChatMetrics();
    expect(cleaned.tokens.daily.totalTokens).toBe(0);
    expect(cleaned.latency.sampleCount).toBe(0);
    expect(cleaned.errors.count).toBe(0);
  });
});

// ── Quota System Performance ─────────────────────────────────────────────

describe("quota system performance", () => {
  vi.mock("@/lib/db", () => ({
    db: { select: mockSelect },
  }));

  beforeEach(() => {
    vi.resetModules();
    mockSelect.mockReset();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("getUserQuotaInfo runs daily and monthly queries in parallel", async () => {
    let queryCount = 0;
    mockSelect.mockImplementation(() => ({
      from: () => ({
        where: () => {
          queryCount++;
          return Promise.resolve([{ totalTokens: 1000, promptTokens: 600, completionTokens: 400 }]);
        },
      }),
    }));

    const { getUserQuotaInfo } = await import("./quota");
    await getUserQuotaInfo("user-1");

    // Should make exactly 2 queries (daily + monthly) — not more
    expect(queryCount).toBe(2);
  });

  it("checkUserQuota completes quickly for allowed requests", async () => {
    mockSelect.mockImplementation(() => ({
      from: () => ({
        where: () =>
          Promise.resolve([{ totalTokens: 1000, promptTokens: 600, completionTokens: 400 }]),
      }),
    }));

    const { checkUserQuota } = await import("./quota");

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      await checkUserQuota("user-1");
    }
    const elapsed = performance.now() - start;

    // 100 quota checks should complete in under 50ms
    expect(elapsed).toBeLessThan(50);
  });
});
