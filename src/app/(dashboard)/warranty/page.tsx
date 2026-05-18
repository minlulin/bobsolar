"use client";

import { format, formatDistanceToNowStrict } from "date-fns";
import { Loader2 } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useReopenWarrantyAlert,
  useResolveWarrantyAlert,
  useWarrantyAlerts,
  useWarrantySummary,
} from "@/hooks/use-warranty";
import { staggerContainer } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { WarrantyListFilter } from "@/lib/validators/warranty";

const FILTER_TABS: Array<{ id: WarrantyListFilter["tab"]; label: string }> = [
  { id: "overdue", label: "Overdue" },
  { id: "due_soon", label: "Due Soon" },
  { id: "upcoming", label: "Upcoming" },
  { id: "resolved", label: "Resolved" },
  { id: "all", label: "Everything" },
];

export default function WarrantyPage(): React.JSX.Element {
  const [tab, setTab] = React.useState<WarrantyListFilter["tab"]>("all");

  const { data: summary, error: summaryError } = useWarrantySummary();
  const { data: alerts, isFetching, error: alertError } = useWarrantyAlerts({ tab });
  const resolveMutation = useResolveWarrantyAlert();
  const reopenMutation = useReopenWarrantyAlert();

  return (
    <div className="space-y-10 pb-32">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-muted-foreground mb-2 text-[11px] font-semibold tracking-[0.4em] uppercase">
            After-sales radar
          </p>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Warranty & aftersales</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
            Stay ahead of panel, inverter and maintenance milestones so crews never scramble.
          </p>
        </div>
      </div>

      {!summaryError && summary ? (
        <motion.div
          variants={staggerContainer}
          animate="animate"
          className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
        >
          <StatCard
            emoji="🔴"
            label="Overdue"
            count={summary.overdue}
            tint="border-red-500/40 bg-red-500/15"
          />
          <StatCard
            emoji="🟡"
            label="Due within 30d"
            count={summary.dueSoon}
            tint="border-amber-400/35 bg-amber-500/10"
          />
          <StatCard
            emoji="🟢"
            label="Healthy horizon"
            count={summary.upcoming}
            tint="border-emerald-500/35 bg-emerald-500/10"
          />
          <StatCard
            emoji="📋"
            label="Active open"
            count={summary.active}
            tint="border-border/70 bg-muted/55"
          />
        </motion.div>
      ) : null}

      <div className="border-border/70 mb-10 flex flex-wrap gap-3 border-b pb-4">
        {FILTER_TABS.map((t) => (
          <Button
            key={t.id}
            type="button"
            variant={tab === t.id ? "secondary" : "ghost"}
            className={`rounded-full text-[11px] font-bold uppercase ${
              tab === t.id ? "border-amber-500/50 bg-amber-500/10" : ""
            }`}
            onClick={() => {
              setTab(t.id);
            }}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {alertError || summaryError ? (
        <p className="text-destructive text-center text-sm">
          {(alertError instanceof Error ? alertError.message : null) ??
            (summaryError instanceof Error ? summaryError.message : "Synchronization glitch")}
        </p>
      ) : isFetching ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="text-solar h-10 w-10 animate-spin" />
        </div>
      ) : !alerts?.length ? (
        <div className="border-border text-muted-foreground rounded-3xl border border-dashed py-24 text-center text-sm">
          Nothing echoes in this wavelength — widen the prism.
        </div>
      ) : (
        <motion.div
          variants={staggerContainer}
          animate="animate"
          className="grid gap-5 lg:grid-cols-2"
        >
          {alerts.map((a) => {
            let dueTone = "text-emerald-700 dark:text-emerald-200";
            if (!a.isResolved && new Date(a.dueDate) < new Date())
              dueTone = "text-red-600 dark:text-red-400";
            else if (!a.isResolved) dueTone = "text-amber-700 dark:text-amber-300";

            return (
              <div
                key={a.id}
                className="border-border bg-card flex flex-col gap-6 rounded-xl border p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <Badge className="text-[10px] uppercase" variant="outline">
                      {a.alertType.replace("_", " ")}
                    </Badge>
                    <Link
                      href={`/projects/${a.projectId}`}
                      className="text-muted-foreground hover:text-foreground mt-2 block text-[11px] font-semibold tracking-wide underline-offset-2 hover:underline"
                    >
                      {a.projectNumber} · <span>{a.customerName}</span>
                    </Link>
                  </div>

                  {!a.isResolved ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full text-[11px]"
                      disabled={resolveMutation.isPending}
                      onClick={() => {
                        resolveMutation.mutate(a.id);
                      }}
                    >
                      Resolve
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full text-[11px]"
                      disabled={reopenMutation.isPending}
                      onClick={() => {
                        reopenMutation.mutate(a.id);
                      }}
                    >
                      Reopen
                    </Button>
                  )}
                </div>

                <p className="text-foreground text-sm leading-relaxed">{a.description}</p>

                <p className={cn("text-[12px] font-semibold uppercase", dueTone)}>
                  {!a.isResolved ? (
                    <>
                      {format(new Date(a.dueDate), "MMM d yyyy")} ·{" "}
                      <span>
                        {formatDistanceToNowStrict(new Date(a.dueDate), {
                          addSuffix: true,
                        })}
                      </span>
                    </>
                  ) : (
                    <>Closed · logged</>
                  )}
                </p>
              </div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}

function StatCard({
  emoji,
  label,
  count,
  tint,
}: {
  emoji: string;
  label: string;
  count: number;
  tint: string;
}): React.JSX.Element {
  return (
    <div className={cn("rounded-[1.5rem] border px-8 py-6 text-center", tint)}>
      <p className="text-5xl">{emoji}</p>
      <p className="text-muted-foreground mt-4 text-[11px] font-bold tracking-[0.3em] uppercase">
        {label}
      </p>
      <p className="mt-2 font-mono text-3xl">{count}</p>
    </div>
  );
}
