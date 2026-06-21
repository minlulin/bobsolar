"use client";

import { BarChart3, DollarSign, RefreshCw, Timer, XCircle, Zap } from "lucide-react";
import { useState } from "react";
import { BackButton } from "@/components/shared/back-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ChatMetricsSnapshot } from "@/lib/chat/metrics";

interface ChatMonitoringClientProps {
  initialMetrics: ChatMetricsSnapshot | null;
}

export function ChatMonitoringClient({
  initialMetrics,
}: ChatMonitoringClientProps): React.JSX.Element {
  const [metrics, setMetrics] = useState<ChatMetricsSnapshot | null>(initialMetrics);
  const [isLoading, setIsLoading] = useState(false);

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      const { getChatMonitoringMetrics } = await import("@/actions/chat-monitoring-actions");
      const result = await getChatMonitoringMetrics();
      if (result.success) {
        setMetrics(result.data);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("Reset all chat monitoring metrics? This cannot be undone.")) return;
    try {
      const { resetChatMonitoringMetrics } = await import("@/actions/chat-monitoring-actions");
      const result = await resetChatMonitoringMetrics();
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
            Chat Monitoring
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Token usage, costs, and performance metrics for the AI assistant.
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
            Reset
          </button>
        </div>
      </div>

      {/* Token Usage */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TokenUsageCard
          title="Daily Tokens"
          bucket={metrics?.tokens.daily}
          icon={Zap}
          color="text-blue-600"
          isLoading={isLoading}
        />
        <TokenUsageCard
          title="Monthly Tokens"
          bucket={metrics?.tokens.monthly}
          icon={BarChart3}
          color="text-violet-600"
          isLoading={isLoading}
        />
      </div>

      {/* Cost & Latency */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CostCard
          title="Daily Cost"
          cost={metrics?.cost.daily}
          icon={DollarSign}
          color="text-emerald-600"
          isLoading={isLoading}
        />
        <CostCard
          title="Monthly Cost"
          cost={metrics?.cost.monthly}
          icon={DollarSign}
          color="text-amber-600"
          isLoading={isLoading}
        />
      </div>

      {/* Latency */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Timer className="text-muted-foreground h-4 w-4" />
            Response Latency (rolling average)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholder
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : metrics ? (
            <div className="space-y-4">
              <LatencyRow label="Average" avgMs={metrics.latency.avgMs} />
              <LatencyRow label="P95" avgMs={metrics.latency.p95Ms} />
            </div>
          ) : (
            <p className="text-muted-foreground py-8 text-center text-sm">
              No latency data collected yet.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Errors */}
      {metrics?.errors.lastError && (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <XCircle className="text-rose-500 h-4 w-4" />
              Recent Errors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Chat Errors</span>
                <span className="text-muted-foreground text-xs">
                  {metrics.errors.lastOccurrence
                    ? new Date(metrics.errors.lastOccurrence).toLocaleString()
                    : "N/A"}
                </span>
              </div>
              <p className="text-muted-foreground mt-1 font-mono text-xs">
                {metrics.errors.lastError}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────

interface TokenUsageCardProps {
  title: string;
  bucket:
    | { totalTokens: number; promptTokens: number; completionTokens: number; requestCount: number }
    | undefined;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  isLoading: boolean;
}

function TokenUsageCard({
  title,
  bucket,
  icon: Icon,
  color,
  isLoading,
}: TokenUsageCardProps): React.JSX.Element {
  const total = bucket?.totalTokens ?? 0;
  const requests = bucket?.requestCount ?? 0;

  return (
    <Card className="border-border transition-shadow hover:shadow-sm">
      <CardContent className="p-5">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-7 w-12" />
          </div>
        ) : (
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs font-medium">{title}</p>
              <p className={`text-2xl font-bold tabular-nums ${color}`}>{total.toLocaleString()}</p>
              <p className="text-muted-foreground text-xs">{requests} requests</p>
            </div>
            <div className="rounded-lg p-2 bg-zinc-50 dark:bg-zinc-900">
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface CostCardProps {
  title: string;
  cost: { totalUsd: number; lastUpdated: Date | null } | undefined;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  isLoading: boolean;
}

function CostCard({ title, cost, icon: Icon, color, isLoading }: CostCardProps): React.JSX.Element {
  const total = cost?.totalUsd ?? 0;

  return (
    <Card className="border-border transition-shadow hover:shadow-sm">
      <CardContent className="p-5">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-7 w-12" />
          </div>
        ) : (
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs font-medium">{title}</p>
              <p className={`text-2xl font-bold tabular-nums ${color}`}>${total.toFixed(4)}</p>
            </div>
            <div className="rounded-lg p-2 bg-zinc-50 dark:bg-zinc-900">
              <Icon className={`h-4 w-4 ${color}`} />
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
}

function LatencyRow({ label, avgMs }: LatencyRowProps): React.JSX.Element {
  const isSlow = avgMs > 500;
  const isVerySlow = avgMs > 2000;

  return (
    <div className="flex items-center justify-between rounded-md border border-border px-4 py-3">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p
        className={`font-semibold tabular-nums ${isVerySlow ? "text-rose-600" : isSlow ? "text-amber-600" : "text-emerald-600"}`}
      >
        {avgMs}ms
      </p>
    </div>
  );
}
