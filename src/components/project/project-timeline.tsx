"use client";

import { format } from "date-fns";
import type { InferSelectModel } from "drizzle-orm";
import { motion } from "motion/react";
import * as React from "react";
import type { projects } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

type ProjectModel = InferSelectModel<typeof projects>;

const PHASE_ORDER = ["planning", "in_progress", "completed"] as const;

interface ProjectTimelineProps {
  project: ProjectModel;
}

function phaseReachable(status: ProjectModel["status"]): number {
  switch (status) {
    case "on_hold":
    case "in_progress":
      return 1;
    case "completed":
      return 2;
    default:
      return 0;
  }
}

export function ProjectTimeline({ project }: ProjectTimelineProps): React.JSX.Element {
  const activeIdx = React.useMemo(() => phaseReachable(project.status), [project.status]);
  const isCancelled = React.useMemo(() => project.status === "cancelled", [project.status]);

  return (
    <div className="border-border bg-muted/30 rounded-3xl border p-8">
      {isCancelled ? (
        <p className="text-destructive text-center text-xs font-semibold tracking-[0.2em] uppercase">
          Project cancelled · timeline discontinued
        </p>
      ) : null}

      <div className="relative mx-auto flex max-w-3xl justify-between px-2 pt-2">
        {/* Progress line */}
        <div className="bg-muted absolute top-10 right-24 left-24 h-[3px]" />
        <motion.div
          className="from-solar shadow-glow-solar absolute top-10 left-24 h-[3px] bg-linear-to-r to-emerald-500"
          layout
          initial={false}
          animate={{
            width: `${Math.min(activeIdx / 2, 1) * 100}%`,
            maxWidth: "calc(100% - 12rem)",
          }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />

        {PHASE_ORDER.map((key, idx) => {
          const active = idx <= activeIdx;
          const glow = idx === activeIdx;

          const label =
            key === "planning" ? "Planning" : key === "in_progress" ? "In progress" : "Completed";

          let subtitle = "";

          if (key === "planning" && project.startDate)
            subtitle = format(new Date(project.startDate), "MMM d, yyyy");
          if (key === "in_progress" && project.targetCompletion && activeIdx >= 1)
            subtitle = `Target ${format(new Date(project.targetCompletion), "MMM d")}`;
          if (key === "completed" && project.actualCompletion)
            subtitle = format(new Date(project.actualCompletion), "MMM d, yyyy");

          return (
            <div key={key} className="relative flex w-36 flex-col items-center text-center">
              <motion.div
                layout
                className={cn(
                  "text-foreground relative z-10 mb-6 flex h-20 w-20 items-center justify-center rounded-4xl border px-5 text-[10px] font-black tracking-[0.35em] uppercase",
                  active ? "shadow-glow border-border/80" : "border-border/60",
                  glow
                    ? "bg-linear-to-br from-amber-500 to-orange-600"
                    : active
                      ? "bg-muted/55"
                      : "bg-muted/80",
                )}
              >
                {idx + 1}
              </motion.div>
              <p className="text-foreground mb-2 text-[11px] font-bold">{label}</p>
              <p className="text-muted-foreground min-h-11 text-[10px] leading-relaxed whitespace-pre-wrap">
                {subtitle}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
