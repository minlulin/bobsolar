/**
 * Chat monitoring metrics — lightweight, in-memory counters for free-tier deployment.
 * Tracks token usage, costs, error rates, and latency for the chat system.
 * Metrics reset on server restart (no external dependency).
 */

interface TokenUsageBucket {
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  requestCount: number;
}

interface CostBucket {
  totalUsd: number;
  lastUpdated: Date | null;
}

interface LatencyBucket {
  samples: number[];
  totalMs: number;
}

interface ErrorBucket {
  count: number;
  lastOccurrence: Date | null;
  lastError: string | null;
}

interface KeyRotationBucket {
  failoverCount: number;
  lastFailoverAt: Date | null;
  lastFailoverFrom: string | null;
  lastFailoverTo: string | null;
}

const MAX_LATENCY_SAMPLES = 100;

const metrics = {
  tokens: {
    daily: {
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      requestCount: 0,
    } as TokenUsageBucket,
    monthly: {
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      requestCount: 0,
    } as TokenUsageBucket,
  },
  cost: {
    daily: { totalUsd: 0, lastUpdated: null } as CostBucket,
    monthly: { totalUsd: 0, lastUpdated: null } as CostBucket,
  },
  latency: {
    samples: [],
    totalMs: 0,
  } as LatencyBucket,
  errors: {
    count: 0,
    lastOccurrence: null as Date | null,
    lastError: null as string | null,
  } as ErrorBucket,
  keyRotation: {
    failoverCount: 0,
    lastFailoverAt: null as Date | null,
    lastFailoverFrom: null as string | null,
    lastFailoverTo: null as string | null,
  } as KeyRotationBucket,
};

// ── Recording Functions ────────────────────────────────────────────────

export function recordChatTokens(promptTokens: number, completionTokens: number): void {
  const total = promptTokens + completionTokens;
  metrics.tokens.daily.totalTokens += total;
  metrics.tokens.daily.promptTokens += promptTokens;
  metrics.tokens.daily.completionTokens += completionTokens;
  metrics.tokens.daily.requestCount += 1;

  metrics.tokens.monthly.totalTokens += total;
  metrics.tokens.monthly.promptTokens += promptTokens;
  metrics.tokens.monthly.completionTokens += completionTokens;
  metrics.tokens.monthly.requestCount += 1;
}

export function recordChatCost(costUsd: number): void {
  metrics.cost.daily.totalUsd += costUsd;
  metrics.cost.daily.lastUpdated = new Date();
  metrics.cost.monthly.totalUsd += costUsd;
  metrics.cost.monthly.lastUpdated = new Date();
}

export function recordChatLatency(ms: number): void {
  metrics.latency.samples.push(ms);
  metrics.latency.totalMs += ms;
  if (metrics.latency.samples.length > MAX_LATENCY_SAMPLES) {
    const removed = metrics.latency.samples.shift();
    if (removed !== undefined) {
      metrics.latency.totalMs -= removed;
    }
  }
}

export function recordChatError(errorCode: string): void {
  metrics.errors.count += 1;
  metrics.errors.lastOccurrence = new Date();
  metrics.errors.lastError = errorCode.slice(0, 500);
}

// ── Key Rotation Tracking ──────────────────────────────────────────────

export function recordKeyFailover(fromLabel: string, toLabel: string): void {
  metrics.keyRotation.failoverCount += 1;
  metrics.keyRotation.lastFailoverAt = new Date();
  metrics.keyRotation.lastFailoverFrom = fromLabel.slice(0, 100);
  metrics.keyRotation.lastFailoverTo = toLabel.slice(0, 100);
}

// ── Aggregation ────────────────────────────────────────────────────────

function avgLatency(): number {
  if (metrics.latency.samples.length === 0) return 0;
  return Math.round(metrics.latency.totalMs / metrics.latency.samples.length);
}

function p95Latency(): number {
  if (metrics.latency.samples.length === 0) return 0;
  const sorted = [...metrics.latency.samples].sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * 0.95);
  const value = sorted[idx] ?? sorted[sorted.length - 1] ?? 0;
  return Math.round(value);
}

// ── Snapshot ──────────────────────────────────────────────────────────

export interface ChatMetricsSnapshot {
  tokens: {
    daily: TokenUsageBucket;
    monthly: TokenUsageBucket;
  };
  cost: {
    daily: CostBucket;
    monthly: CostBucket;
  };
  latency: {
    avgMs: number;
    p95Ms: number;
    sampleCount: number;
  };
  errors: ErrorBucket;
  keyRotation: KeyRotationBucket;
  collectedAt: string;
}

export function getChatMetrics(): ChatMetricsSnapshot {
  return {
    tokens: {
      daily: { ...metrics.tokens.daily },
      monthly: { ...metrics.tokens.monthly },
    },
    cost: {
      daily: { ...metrics.cost.daily },
      monthly: { ...metrics.cost.monthly },
    },
    latency: {
      avgMs: avgLatency(),
      p95Ms: p95Latency(),
      sampleCount: metrics.latency.samples.length,
    },
    errors: { ...metrics.errors },
    keyRotation: { ...metrics.keyRotation },
    collectedAt: new Date().toISOString(),
  };
}

export function resetChatMetrics(): void {
  metrics.tokens.daily = { totalTokens: 0, promptTokens: 0, completionTokens: 0, requestCount: 0 };
  metrics.tokens.monthly = {
    totalTokens: 0,
    promptTokens: 0,
    completionTokens: 0,
    requestCount: 0,
  };
  metrics.cost.daily = { totalUsd: 0, lastUpdated: null };
  metrics.cost.monthly = { totalUsd: 0, lastUpdated: null };
  metrics.latency = { samples: [], totalMs: 0 };
  metrics.errors = { count: 0, lastOccurrence: null, lastError: null };
  metrics.keyRotation = {
    failoverCount: 0,
    lastFailoverAt: null,
    lastFailoverFrom: null,
    lastFailoverTo: null,
  };
}
