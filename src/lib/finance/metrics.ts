/**
 * Finance monitoring metrics - lightweight, in-memory counters for free-tier deployment.
 * Tracks journal post failures, imbalance rejections, and finance page latency.
 * Metrics reset on server restart (no external dependency).
 */

interface MetricBucket {
  count: number;
  lastOccurrence: Date | null;
  lastError: string | null;
}

interface LatencyBucket {
  samples: number[];
  totalMs: number;
}

const metrics = {
  journalPostFailures: {
    count: 0,
    lastOccurrence: null as Date | null,
    lastError: null as string | null,
  } as MetricBucket,
  latency: {
    financeDashboard: { samples: [], totalMs: 0 } as LatencyBucket,
    ledgerPage: { samples: [], totalMs: 0 } as LatencyBucket,
    mainDashboard: { samples: [], totalMs: 0 } as LatencyBucket,
  },
};

const MAX_SAMPLES = 100;

function recordFailure(bucket: MetricBucket, error: string): void {
  bucket.count += 1;
  bucket.lastOccurrence = new Date();
  bucket.lastError = error.slice(0, 500);
}

function recordLatency(bucket: LatencyBucket, ms: number): void {
  bucket.samples.push(ms);
  bucket.totalMs += ms;
  if (bucket.samples.length > MAX_SAMPLES) {
    const removed = bucket.samples.shift();
    if (removed !== undefined) {
      bucket.totalMs -= removed;
    }
  }
}

export function recordJournalPostFailure(error: string): void {
  recordFailure(metrics.journalPostFailures, error);
}

export function recordFinanceDashboardLatency(ms: number): void {
  recordLatency(metrics.latency.financeDashboard, ms);
}

export function recordLedgerPageLatency(ms: number): void {
  recordLatency(metrics.latency.ledgerPage, ms);
}

export function recordMainDashboardLatency(ms: number): void {
  recordLatency(metrics.latency.mainDashboard, ms);
}

function avgLatency(bucket: LatencyBucket): number {
  if (bucket.samples.length === 0) return 0;
  return Math.round(bucket.totalMs / bucket.samples.length);
}

function p95Latency(bucket: LatencyBucket): number {
  if (bucket.samples.length === 0) return 0;
  const sorted = [...bucket.samples].sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * 0.95);
  const value = sorted[idx] ?? sorted[sorted.length - 1];
  return Math.round(value as number);
}

export interface FinanceMetricsSnapshot {
  journalPostFailures: MetricBucket;
  latency: {
    financeDashboard: { avgMs: number; p95Ms: number; sampleCount: number };
    ledgerPage: { avgMs: number; p95Ms: number; sampleCount: number };
    mainDashboard: { avgMs: number; p95Ms: number; sampleCount: number };
  };
  collectedAt: string;
}

export function getFinanceMetrics(): FinanceMetricsSnapshot {
  return {
    journalPostFailures: { ...metrics.journalPostFailures },
    latency: {
      financeDashboard: {
        avgMs: avgLatency(metrics.latency.financeDashboard),
        p95Ms: p95Latency(metrics.latency.financeDashboard),
        sampleCount: metrics.latency.financeDashboard.samples.length,
      },
      ledgerPage: {
        avgMs: avgLatency(metrics.latency.ledgerPage),
        p95Ms: p95Latency(metrics.latency.ledgerPage),
        sampleCount: metrics.latency.ledgerPage.samples.length,
      },
      mainDashboard: {
        avgMs: avgLatency(metrics.latency.mainDashboard),
        p95Ms: p95Latency(metrics.latency.mainDashboard),
        sampleCount: metrics.latency.mainDashboard.samples.length,
      },
    },
    collectedAt: new Date().toISOString(),
  };
}

export function resetFinanceMetrics(): void {
  metrics.journalPostFailures = { count: 0, lastOccurrence: null, lastError: null };
  metrics.latency.financeDashboard = { samples: [], totalMs: 0 };
  metrics.latency.ledgerPage = { samples: [], totalMs: 0 };
  metrics.latency.mainDashboard = { samples: [], totalMs: 0 };
}
