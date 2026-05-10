'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { staggerItem } from '@/lib/motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { format } from 'date-fns';
import { formatMMK } from '@/lib/pricing/engine';
import type { ProjectListRow } from '@/actions/project-actions';
import { cn } from '@/lib/utils';

function statusTone(status: ProjectListRow['status']) {
  switch (status) {
    case 'planning':
      return 'border-indigo-500/35 bg-indigo-500/10 text-indigo-200';
    case 'in_progress':
      return 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300';
    case 'on_hold':
      return 'border-amber-500/35 bg-amber-500/10 text-amber-300';
    case 'completed':
      return 'border-white/25 bg-white/12 text-emerald-200';
    case 'cancelled':
      return 'border-red-400/35 bg-red-500/15 text-red-200';
    default:
      return '';
  }
}

function budgetPct(actual: number, quoted: number) {
  if (quoted <= 0) return actual > 0 ? 999 : 0;
  return (actual / quoted) * 100;
}

interface ProjectCardProps {
  project: ProjectListRow;
  hrefBase?: string;
}

export function ProjectCard({
  project,
  hrefBase = '/projects',
}: ProjectCardProps) {
  const quoted = React.useMemo(
    () => Number(project.quotedTotal),
    [project.quotedTotal],
  );

  const pct = React.useMemo(
    () => budgetPct(project.costTotal, quoted),
    [project.costTotal, quoted],
  );

  const barTone = React.useMemo(() => {
    if (pct > 100) return 'from-rose-500 to-red-600';
    if (pct >= 80) return 'from-amber-400 to-orange-600';
    return 'from-emerald-400 to-teal-600';
  }, [pct]);

  const showBudgetBar = React.useMemo(
    () => project.status !== 'completed' && project.status !== 'cancelled',
    [project.status],
  );

  const variancePct = React.useMemo(
    () =>
      quoted > 0
        ? (((project.costTotal - quoted) / quoted) * 100).toFixed(1)
        : '0',
    [quoted, project.costTotal],
  );

  const warrantyLine = React.useMemo(() => {
    if (project.warrantySummary === 'overdue') return '� Overdue alerts';
    if (project.warrantySummary === 'due_soon') return '🟡 Due soon';
    return '� All OK';
  }, [project.warrantySummary]);

  return (
    <motion.div variants={staggerItem}>
      <Card className="group border-white/12 bg-black/40 backdrop-blur-md transition hover:-translate-y-1 hover:shadow-[0_20px_50px_-15px_rgba(245,158,11,.45)]">
        <CardContent className="relative space-y-5 p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Link
                href={`${hrefBase}/${project.id}`}
                className="font-heading text-lg font-semibold tracking-[0.2em] uppercase"
              >
                {project.projectNumber}
              </Link>
              <p className="text-muted-foreground text-sm">
                {project.customerName}
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Badge
                className={cn(
                  'border text-[10px] font-semibold uppercase',
                  statusTone(project.status),
                )}
              >
                {project.status.replace('_', ' ')}
              </Badge>
              {project.status === 'in_progress' && (
                <span className="absolute top-12 right-6 h-2 w-2 animate-pulse rounded-full bg-emerald-500/70" />
              )}
            </div>
          </div>

          <div className="grid gap-4 text-sm md:grid-cols-3">
            <div>
              <p className="text-muted-foreground mb-1 text-[10px] font-bold tracking-[0.3em] uppercase">
                System size
              </p>
              <p className="font-mono text-lg font-semibold text-white">
                {Number(project.systemSizeKwp)} kWp
              </p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1 text-[10px] font-bold tracking-[0.3em] uppercase">
                Dates
              </p>
              <p className="text-xs leading-relaxed">
                {project.startDate || project.createdAt
                  ? format(
                      new Date(project.startDate ?? project.createdAt),
                      'MMM d',
                    )
                  : '—'}{' '}
                →{' '}
                {(project.targetCompletion ?? project.actualCompletion)
                  ? format(
                      new Date(
                        project.targetCompletion ?? project.actualCompletion!,
                      ),
                      'MMM d, yyyy',
                    )
                  : 'TBD'}
              </p>
            </div>
            <div className="md:text-right">
              <p className="text-muted-foreground mb-1 text-[10px] font-bold tracking-[0.3em] uppercase">
                Warranty signals
              </p>
              {project.status === 'completed' ? (
                <p className="text-xs font-semibold text-white">
                  {warrantyLine}
                </p>
              ) : (
                <p className="text-muted-foreground text-[11px]">
                  Alerts unlock after completion
                </p>
              )}
            </div>
          </div>

          {showBudgetBar ? (
            <div className="text-muted-foreground text-xs">
              <p className="text-[10px] font-semibold uppercase">
                Spend vs quotation
              </p>
              <div className="bg-muted mt-2 h-2 overflow-hidden rounded-full">
                <div
                  style={{ width: `${Math.min(pct, 120)}%` }}
                  className={cn(
                    'h-full bg-gradient-to-r transition-all duration-500',
                    barTone,
                  )}
                />
              </div>
              <p className="mt-1 flex justify-between gap-3 text-[11px]">
                <span>{formatMMK(project.costTotal)} actual</span>
                <span>{formatMMK(quoted)} quoted</span>
              </p>
            </div>
          ) : (
            <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-white/10 pt-4 text-[11px]">
              <div>
                {project.actualCompletion ? (
                  <span className="text-foreground font-semibold">
                    Finished{' '}
                    {format(new Date(project.actualCompletion), 'MMM d, yyyy')}
                  </span>
                ) : (
                  <span>Milestone pending</span>
                )}
              </div>
              {project.status === 'completed' && (
                <span className="font-mono">Variance · {variancePct}%</span>
              )}
            </div>
          )}

          <div className="border-border mt-6 flex justify-between gap-5 border-t border-dashed pt-5">
            <div className="text-muted-foreground text-[10px]">
              Quote ·{' '}
              <span className="font-mono font-semibold text-white">
                {project.quoteNumber ?? 'Manual'}
              </span>
            </div>

            <Button
              asChild
              size="sm"
              variant="secondary"
              className="rounded-full px-8"
            >
              <Link href={`${hrefBase}/${project.id}`}>View detail</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
