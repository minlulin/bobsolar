"use client";

import { format } from "date-fns";
import Link from "next/link";
import * as React from "react";
import type { ProjectListRow } from "@/actions/project-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatMMK } from "@/lib/utils";

function statusTone(status: ProjectListRow["status"]): string {
  switch (status) {
    case "planning":
      return "border-indigo-500/35 bg-indigo-500/10 text-indigo-600 dark:text-indigo-200";
    case "in_progress":
      return "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "on_hold":
      return "border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    case "completed":
      return "border-border/70 bg-emerald-500/15 text-emerald-700 dark:text-emerald-200";
    case "cancelled":
      return "border-red-400/35 bg-red-500/15 text-red-600 dark:text-red-200";
    default:
      return "";
  }
}

function budgetPct(actual: number, quoted: number): number {
  if (quoted <= 0) return actual > 0 ? 999 : 0;
  return (actual / quoted) * 100;
}

interface ProjectCardProps {
  project: ProjectListRow;
  hrefBase?: string;
}

export function ProjectCard({
  project,
  hrefBase = "/projects",
}: ProjectCardProps): React.JSX.Element {
  const quoted = React.useMemo(() => Number(project.quotedTotal), [project.quotedTotal]);

  const pct = React.useMemo(
    () => budgetPct(project.costTotal, quoted),
    [project.costTotal, quoted],
  );

  const barTone = React.useMemo(() => {
    if (pct > 100) return "from-rose-500 to-red-600";
    if (pct >= 80) return "from-amber-400 to-orange-600";
    return "from-emerald-400 to-teal-600";
  }, [pct]);

  const showBudgetBar = React.useMemo(
    () => project.status !== "completed" && project.status !== "cancelled",
    [project.status],
  );

  const variancePct = React.useMemo(
    () => (quoted > 0 ? (((project.costTotal - quoted) / quoted) * 100).toFixed(1) : "0"),
    [quoted, project.costTotal],
  );

  const warrantyLine = React.useMemo(() => {
    if (project.warrantySummary === undefined) return null;
    if (project.warrantySummary === "overdue") return "⚠ Overdue alerts";
    if (project.warrantySummary === "due_soon") return "🟡 Due soon";
    return "✅ All OK";
  }, [project.warrantySummary]);

  return (
    <div className="transition-all">
      <Card className="bg-card border-border group hover:bg-muted/30 border transition-colors">
        <CardContent className="relative space-y-3 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Link
                href={`${hrefBase}/${project.id}`}
                className="font-heading text-sm font-semibold tracking-[0.15em] uppercase"
              >
                {project.projectNumber}
              </Link>
              <p className="text-muted-foreground text-xs">{project.customerName}</p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Badge
                className={cn(
                  "border text-[10px] font-semibold uppercase",
                  statusTone(project.status),
                )}
              >
                {project.status.replace("_", " ")}
              </Badge>
              {project.status === "in_progress" && (
                <span className="absolute top-12 right-6 h-2 w-2 animate-pulse rounded-full bg-emerald-500/70" />
              )}
            </div>
          </div>

          <div className="grid gap-3 text-xs md:grid-cols-3">
            <div>
              <p className="text-muted-foreground mb-0.5 text-[9px] font-bold tracking-[0.2em] uppercase">
                System size
              </p>
              <p className="text-foreground font-mono text-sm font-semibold">
                {Number(project.systemSizeKwp)} kWp
              </p>
            </div>
            <div>
              <p className="text-muted-foreground mb-0.5 text-[9px] font-bold tracking-[0.2em] uppercase">
                Dates
              </p>
              <p className="text-xs leading-relaxed">
                {format(new Date(project.startDate ?? project.createdAt), "MMM d")} →{" "}
                {project.targetCompletion || project.actualCompletion
                  ? format(
                      new Date(
                        (project.targetCompletion ?? project.actualCompletion) as string | Date,
                      ),
                      "MMM d, yyyy",
                    )
                  : "TBD"}
              </p>
            </div>
            <div className="md:text-right">
              <p className="text-muted-foreground mb-0.5 text-[9px] font-bold tracking-[0.2em] uppercase">
                Warranty signals
              </p>
              {project.status === "completed" && warrantyLine ? (
                <p className="text-foreground text-xs font-semibold">{warrantyLine}</p>
              ) : (
                <p className="text-muted-foreground text-[11px]">
                  {project.status === "completed"
                    ? "Warranty data unavailable"
                    : "Alerts unlock after completion"}
                </p>
              )}
            </div>
          </div>

          {showBudgetBar ? (
            <div className="text-muted-foreground text-xxs">
              <p className="text-[10px] font-semibold uppercase">Spend vs quotation</p>
              <div className="bg-muted mt-2 h-2 overflow-hidden rounded-full">
                <div
                  style={{ width: `${Math.min(pct, 120)}%` }}
                  className={cn("h-full bg-gradient-to-r transition-all duration-500", barTone)}
                />
              </div>
              <p className="mt-1 flex justify-between gap-3 text-[11px]">
                <span>{formatMMK(project.costTotal)} actual</span>
                <span>{formatMMK(quoted)} quoted</span>
              </p>
            </div>
          ) : (
            <div className="text-muted-foreground border-border/60 flex flex-wrap items-center justify-between gap-3 border-t border-dashed pt-4 text-[11px]">
              <div>
                {project.actualCompletion ? (
                  <span className="text-foreground font-semibold">
                    Finished {format(new Date(project.actualCompletion), "MMM d, yyyy")}
                  </span>
                ) : (
                  <span>Milestone pending</span>
                )}
              </div>
              {project.status === "completed" && (
                <span className="font-mono">Variance · {variancePct}%</span>
              )}
            </div>
          )}

          <div className="border-border mt-3 flex items-center justify-between gap-3 border-t border-dashed pt-3">
            <div className="text-muted-foreground text-[10px]">
              Quote ·{" "}
              <span className="text-foreground font-mono font-semibold">
                {project.quoteNumber ?? "Manual"}
              </span>
            </div>

            <Button asChild size="sm" variant="secondary" className="rounded-full px-5 text-xs">
              <Link href={`${hrefBase}/${project.id}`}>View detail</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
