"use client";

import { Activity, RefreshCw, XCircle } from "lucide-react";
import { useState } from "react";
import { BackButton } from "@/components/shared/back-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { FinanceMetricsSnapshot } from "@/lib/finance/metrics";

interface MonitoringClientProps {
  initialMetrics: FinanceMetricsSnapshot | null;
}

export function MonitoringClient({ initialMetrics }: MonitoringClientProps): React.JSX.Element {
  const [metrics, setMetrics] = useState<FinanceMetricsSnapshot | null>(initialMetrics);
  const [isLoading, setIsLoading] = useState(false);

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      const { getMonitoringMetrics } = await import("@/actions/monitoring-actions");
      const result = await getMonitoringMetrics();
      if (result.success) {
        setMetrics(result.data);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("Reset all monitoring metrics? This cannot be undone.")) return;
    try {
      const { resetMonitoringMetrics } = await import("@/actions/monitoring-actions");
      const result = await resetMonitoringMetrics();
      if (result.success) {
        await handleRefresh();
      }
    } catch {
      // Reset failed
    }
  };

  return (
    <div className="space-y-6">
      <BackButton />
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Finance Monitoring
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            System health, error rates, and performance metrics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-md bg-(--color-deep-navy) px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-(--color-deep-navy)/90 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            {isLoading ? "Loading..." : "Refresh"}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
          >
            Reset Counters
          </button>
        </div>
      </div>

      {/* Error Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ErrorMetricCard
          label="Journal Post Failures"
          bucket={metrics?.journalPostFailures}
          icon={XCircle}
          color="text-rose-600"
          isLoading={isLoading}
        />
      </div>

      {/* Latency Metrics */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Activity className="text-muted-foreground h-4 w-4" />
            Page Latency (rolling average)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholder
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : metrics ? (
            <div className="space-y-4">
              <LatencyRow
                label="Finance Dashboard"
                avgMs={metrics.latency.financeDashboard.avgMs}
                p95Ms={metrics.latency.financeDashboard.p95Ms}
                samples={metrics.latency.financeDashboard.sampleCount}
              />
              <LatencyRow
                label="Master Ledger"
                avgMs={metrics.latency.ledgerPage.avgMs}
                p95Ms={metrics.latency.ledgerPage.p95Ms}
                samples={metrics.latency.ledgerPage.sampleCount}
              />
              <LatencyRow
                label="Main Dashboard"
                avgMs={metrics.latency.mainDashboard.avgMs}
                p95Ms={metrics.latency.mainDashboard.p95Ms}
                samples={metrics.latency.mainDashboard.sampleCount}
              />
            </div>
          ) : (
            <p className="text-muted-foreground py-8 text-center text-sm">
              No latency data collected yet.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Last Error Details */}
      {metrics && (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Recent Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {metrics.journalPostFailures.lastError ? (
                <div className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">
                      Journal Post Failures
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {metrics.journalPostFailures.lastOccurrence
                        ? new Date(metrics.journalPostFailures.lastOccurrence).toLocaleString()
                        : "N/A"}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1 font-mono text-xs">
                    {metrics.journalPostFailures.lastError}
                  </p>
                </div>
              ) : (
                <p className="text-muted-foreground py-4 text-center text-sm">
                  No errors recorded. System is healthy.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface ErrorMetricCardProps {
  label: string;
  bucket: { count: number; lastOccurrence: Date | null; lastError: string | null } | undefined;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  isLoading: boolean;
}

function ErrorMetricCard({
  label,
  bucket,
  icon: Icon,
  color,
  isLoading,
}: ErrorMetricCardProps): React.JSX.Element {
  const count = bucket?.count ?? 0;
  const hasErrors = count > 0;

  return (
    <Card
      className={`border-border transition-shadow hover:shadow-sm ${hasErrors ? "border-rose-200 bg-rose-50/30" : ""}`}
    >
      <CardContent className="p-5">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-7 w-12" />
          </div>
        ) : (
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs font-medium">{label}</p>
              <p
                className={`text-2xl font-bold tabular-nums ${hasErrors ? color : "text-emerald-600"}`}
              >
                {count}
              </p>
            </div>
            <div className={`rounded-lg p-2 ${hasErrors ? "bg-rose-100" : "bg-emerald-50"}`}>
              <Icon className={`h-4 w-4 ${hasErrors ? color : "text-emerald-600"}`} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface LatencyRowProps {
  label: string;
  avgMs: number;
  p95Ms: number;
  samples: number;
}

function LatencyRow({ label, avgMs, p95Ms, samples }: LatencyRowProps): React.JSX.Element {
  const isSlow = avgMs > 1000;
  const isVerySlow = avgMs > 3000;

  return (
    <div className="flex items-center justify-between rounded-md border border-border px-4 py-3">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-muted-foreground text-xs">{samples} samples</p>
      </div>
      <div className="flex items-center gap-2 text-right">
        <div>
          <p className="text-muted-foreground text-xs">Avg</p>
          <p
            className={`font-semibold tabular-nums ${isVerySlow ? "text-rose-600" : isSlow ? "text-amber-600" : "text-emerald-600"}`}
          >
            {avgMs}ms
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">P95</p>
          <p
            className={`font-semibold tabular-nums ${isVerySlow ? "text-rose-600" : isSlow ? "text-amber-600" : "text-emerald-600"}`}
          >
            {p95Ms}ms
          </p>
        </div>
      </div>
    </div>
  );
}
