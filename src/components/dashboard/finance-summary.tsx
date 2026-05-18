"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import type * as React from "react";
import { useFinanceSummary } from "@/hooks/use-payments";
import { cn, formatMMK } from "@/lib/utils";

export function FinanceSummary(): React.JSX.Element {
  const { data, isPending } = useFinanceSummary();

  if (isPending) {
    return (
      <div className="border-border bg-card rounded-2xl border p-6">
        <div className="bg-muted mb-6 h-4 w-32 animate-pulse rounded" />
        <div className="space-y-3">
          <div className="bg-muted h-16 animate-pulse rounded-xl" />
          <div className="bg-muted h-16 animate-pulse rounded-xl" />
        </div>
      </div>
    );
  }

  const monthlyData = data?.monthly ?? [];

  return (
    <div className="border-border bg-card rounded-2xl border p-6">
      <h2 className="text-muted-foreground mb-6 text-xs font-bold tracking-widest uppercase">
        Finance Summary
      </h2>

      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-muted/30 border-border/50 rounded-xl border p-4">
            <p className="text-muted-foreground mb-1 text-[10px] font-bold tracking-wide uppercase">
              Incoming
            </p>
            <p className="font-mono text-lg font-bold text-emerald-400">
              {formatMMK(data?.totalIncoming ?? 0)}
            </p>
          </div>
          <div className="bg-muted/30 border-border/50 rounded-xl border p-4">
            <p className="text-muted-foreground mb-1 text-[10px] font-bold tracking-wide uppercase">
              Outgoing
            </p>
            <p className="font-mono text-lg font-bold text-rose-400">
              {formatMMK(data?.totalOutgoing ?? 0)}
            </p>
          </div>
          <div className="bg-muted/30 border-border/50 rounded-xl border p-4">
            <p className="text-muted-foreground mb-1 text-[10px] font-bold tracking-wide uppercase">
              Net
            </p>
            <p
              className={cn(
                "font-mono text-lg font-bold",
                (data?.totalIncoming ?? 0) - (data?.totalOutgoing ?? 0) >= 0
                  ? "text-emerald-400"
                  : "text-rose-400",
              )}
            >
              {formatMMK(Math.abs((data?.totalIncoming ?? 0) - (data?.totalOutgoing ?? 0)))}
            </p>
          </div>
        </div>

        {monthlyData.length > 0 ? (
          <div className="space-y-2">
            <p className="text-muted-foreground text-[10px] font-bold tracking-wide uppercase">
              Monthly Trend (6mo)
            </p>
            <div className="space-y-1">
              {monthlyData.map((m) => (
                <div
                  key={m.month}
                  className="bg-muted/20 flex items-center justify-between rounded-lg px-3 py-2"
                >
                  <span className="text-muted-foreground text-[11px] font-semibold">{m.month}</span>
                  <div className="flex items-center gap-4 text-[10px]">
                    <span className="font-mono text-emerald-400">+{formatMMK(m.incoming)}</span>
                    <span className="font-mono text-rose-400">-{formatMMK(m.outgoing)}</span>
                    <span
                      className={cn(
                        "font-mono font-bold",
                        m.net >= 0 ? "text-emerald-300" : "text-rose-300",
                      )}
                    >
                      {m.net >= 0 ? "+" : ""}
                      {formatMMK(m.net)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {(data?.unpaidCompleted ?? 0) > 0 ? (
          <Link
            href="/projects/completed"
            className="mt-4 flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 transition-all hover:bg-amber-500/20"
          >
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />
            <div>
              <p className="text-sm font-bold text-amber-200">
                {data?.unpaidCompleted} completed project
                {data?.unpaidCompleted === 1 ? "" : "s"} with outstanding balance
              </p>
              <p className="text-muted-foreground text-xs">
                Review payment status on completed projects.
              </p>
            </div>
          </Link>
        ) : null}
      </div>
    </div>
  );
}
