"use client";

import { ArrowRight, ClipboardCheck, Loader2, XCircle } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  PROJECT_STATUS_LABELS,
  type ProjectStatus,
  permittedNextStatuses,
} from "@/lib/domain/enums";
import { cn } from "@/lib/utils";

const STATE_META: Record<ProjectStatus, { index: number; color: string; icon: React.ReactNode }> = {
  planning: {
    index: 0,
    color: "border-indigo-500/35 bg-indigo-500/10 text-indigo-200",
    icon: null,
  },
  in_progress: {
    index: 1,
    color: "border-emerald-500/35 bg-emerald-500/10 text-emerald-200",
    icon: null,
  },
  on_hold: {
    index: 2,
    color: "border-amber-500/35 bg-amber-500/10 text-amber-300",
    icon: null,
  },
  completed: {
    index: 3,
    color: "border-border/70 bg-emerald-500/15 text-emerald-200",
    icon: <ClipboardCheck className="h-3.5 w-3.5" />,
  },
  cancelled: {
    index: 4,
    color: "border-red-400/35 bg-red-600/25 text-red-100",
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
};

interface ProjectStateRailProps {
  currentStatus: ProjectStatus;
  isAdmin: boolean;
  isPending: boolean;
  onTransition: (to: ProjectStatus) => void;
  onMarkCompleted: () => void;
}

export function ProjectStateRail({
  currentStatus,
  isAdmin,
  isPending,
  onTransition,
  onMarkCompleted,
}: ProjectStateRailProps): React.JSX.Element {
  const nextStates = React.useMemo(() => permittedNextStatuses(currentStatus), [currentStatus]);

  const isTerminal = currentStatus === "completed" || currentStatus === "cancelled";

  return (
    <div className="bg-card border-border rounded-2xl border p-5">
      <p className="text-muted-foreground mb-4 text-[10px] font-bold tracking-[0.3em] uppercase">
        Project lifecycle
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-[11px] font-bold uppercase",
            STATE_META[currentStatus].color,
          )}
        >
          {STATE_META[currentStatus].icon}
          {PROJECT_STATUS_LABELS[currentStatus]}
        </span>

        {!isTerminal && nextStates.length > 0 ? (
          <span className="text-muted-foreground mx-1 text-[10px]">
            <ArrowRight className="inline h-3 w-3" />
          </span>
        ) : null}

        {nextStates.map((next) => {
          const isCompletedAction = next === "completed";
          const isCancelledAction = next === "cancelled";
          const canAct = isAdmin && !isPending;

          return (
            <Button
              key={next}
              variant="outline"
              size="sm"
              disabled={!canAct}
              onClick={() => {
                if (isCompletedAction) {
                  onMarkCompleted();
                } else {
                  onTransition(next);
                }
              }}
              className={cn(
                "rounded-full text-[10px] font-bold tracking-wide uppercase",
                isCompletedAction &&
                  "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20",
                isCancelledAction &&
                  "border-red-400/30 bg-red-500/10 text-red-300 hover:bg-red-500/20",
                !isCompletedAction &&
                  !isCancelledAction &&
                  "border-indigo-500/30 bg-indigo-500/10 text-indigo-200 hover:bg-indigo-500/20",
              )}
            >
              {isPending ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : isCompletedAction ? (
                <ClipboardCheck className="mr-1 h-3 w-3" />
              ) : null}
              {PROJECT_STATUS_LABELS[next]}
            </Button>
          );
        })}
      </div>

      {isTerminal ? (
        <p className="text-muted-foreground mt-3 text-[11px]">
          {currentStatus === "completed"
            ? "Project handover complete. Generate vouchers below."
            : "Project was cancelled. No further transitions available."}
        </p>
      ) : nextStates.length === 0 ? (
        <p className="text-muted-foreground mt-3 text-[11px]">No further transitions available.</p>
      ) : !isAdmin ? (
        <p className="text-muted-foreground mt-3 text-[11px] italic">
          Admin access required to advance project status.
        </p>
      ) : null}
    </div>
  );
}
