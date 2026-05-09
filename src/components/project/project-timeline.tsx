'use client';

import { motion } from 'framer-motion';
import type { InferSelectModel } from 'drizzle-orm';
import { projects } from '@/lib/db/schema';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

type ProjectModel = InferSelectModel<typeof projects>;

const PHASE_ORDER = ['planning', 'in_progress', 'completed'] as const;

interface ProjectTimelineProps {
  project: ProjectModel;
}

function phaseReachable(status: ProjectModel['status']): number {
  if (status === 'cancelled') return 0;
  if (status === 'planning' || status === 'on_hold') return 0;
  if (status === 'in_progress') return 1;
  if (status === 'completed') return 2;
  return 0;
}

export function ProjectTimeline({ project }: ProjectTimelineProps) {
  const activeIdx = phaseReachable(project.status);
  const isCancelled = project.status === 'cancelled';

  return (
    <div className="border-border rounded-3xl border bg-white/[0.03] p-8">
      {isCancelled ? (
        <p className="text-destructive text-center text-xs font-semibold uppercase tracking-[0.2em]">
          Project cancelled · timeline discontinued
        </p>
      ) : null}

      <div className="relative mx-auto flex max-w-3xl justify-between px-2 pt-2">
        {/* Progress line */}
        <div className="bg-muted absolute top-10 right-24 left-24 h-[3px]" />
        <motion.div
          className="from-solar shadow-glow-solar absolute top-10 left-24 h-[3px] bg-gradient-to-r to-emerald-500"
          layout
          initial={false}
          animate={{
            width: `${Math.min(activeIdx / 2, 1) * 100}%`,
            maxWidth: 'calc(100% - 12rem)',
          }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />

        {PHASE_ORDER.map((key, idx) => {
          const active = idx <= activeIdx;
          const glow = idx === activeIdx;

          const label =
            key === 'planning'
              ? 'Planning'
              : key === 'in_progress'
                ? 'In progress'
                : 'Completed';

          let subtitle = '';

          if (key === 'planning' && project.startDate)
            subtitle = format(new Date(project.startDate), 'MMM d, yyyy');
          if (
            key === 'in_progress' &&
            project.targetCompletion &&
            activeIdx >= 1
          )
            subtitle = `Target ${format(new Date(project.targetCompletion), 'MMM d')}`;
          if (key === 'completed' && project.actualCompletion)
            subtitle = format(
              new Date(project.actualCompletion),
              'MMM d, yyyy',
            );

          return (
            <div
              key={key}
              className="relative flex w-36 flex-col items-center text-center"
            >
              <motion.div
                layout
                className={cn(
                  'relative z-10 mb-6 flex h-20 w-20 items-center justify-center rounded-[2rem] border px-5 text-[10px] font-black tracking-[0.35em] text-white uppercase',
                  active ? 'shadow-glow border-white/40' : 'border-white/5',
                  glow
                    ? 'bg-gradient-to-br from-amber-500 to-orange-600'
                    : active
                      ? 'bg-white/15'
                      : 'bg-muted/80',
                )}
              >
                {idx + 1}
              </motion.div>
              <p className="text-foreground mb-2 text-[11px] font-bold">{label}</p>
              <p className="text-muted-foreground min-h-[2.75rem] text-[10px] leading-relaxed whitespace-pre-wrap">
                {subtitle}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
