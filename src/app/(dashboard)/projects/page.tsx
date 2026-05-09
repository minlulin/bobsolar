'use client';

import { useMemo, useState } from 'react';
import { Loader2, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { staggerContainer } from '@/lib/motion';
import { useProjects } from '@/hooks/use-projects';
import type { ProjectListFilter } from '@/lib/validators/project';
import { ProjectCard } from '@/components/project/project-card';
import { Button } from '@/components/ui/button';
import type { InferSelectModel } from 'drizzle-orm';
import { projects } from '@/lib/db/schema';

type ProjectStatus = InferSelectModel<typeof projects>['status'];

const FILTER_GROUPS: Array<{
  id: string;
  label: string;
  status?: ProjectStatus;
}> = [
  { id: 'active', label: 'All Active' },
  { id: 'planning', label: 'Planning', status: 'planning' },
  { id: 'in_progress', label: 'Live sites', status: 'in_progress' },
  { id: 'on_hold', label: 'Breather', status: 'on_hold' },
];

export default function ActiveProjectsPage() {
  const [filter, setFilter] = useState<string>('active');

  const queryFilters = useMemo<Partial<ProjectListFilter>>(() => {
    if (filter === 'active') return { scope: 'active' };

    const found = FILTER_GROUPS.find((pill) => pill.id === filter);
    return {
      scope: 'active',
      status: found?.status,
    };
  }, [filter]);

  const { data, isLoading, error } = useProjects(queryFilters);
  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tighter">
            Active projects
          </h1>
          <p className="text-muted-foreground max-w-xl text-sm leading-relaxed">
            Each card syncs quotations, budgeting, crews, and aftercare touchpoints —
            orbit through status chips to tighten your focus radius.
          </p>
          <p className="text-muted-foreground mt-6 text-[12px] font-semibold uppercase tracking-[0.45em]">
            {total} orbital mission{total === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/projects/completed">Completed installs</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/warranty">Warranty pulses</Link>
          </Button>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2">
        {FILTER_GROUPS.map((pill) => {
          const glow = pill.id === filter;

          return (
            <motion.button
              key={pill.id}
              layout
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={() => setFilter(pill.id)}
              className={`relative whitespace-nowrap rounded-full border px-6 py-2 text-[11px] font-semibold uppercase transition ${
                glow
                  ? 'border-transparent bg-gradient-to-r from-orange-600/95 to-rose-900/95 text-white shadow-[0_0_24px_-6px_rgb(251,146,60)]'
                  : 'border-white/25 bg-transparent text-muted-foreground hover:bg-white/5 hover:text-white'
              }`}
            >
              <span>{pill.label}</span>
              {glow ? (
                <span className="border-solar animate-pulse absolute inset-0 -z-[1] rounded-full border-[1.5px] opacity-95" />
              ) : null}
            </motion.button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="text-solar h-10 w-10 animate-spin" />
        </div>
      ) : error ? (
        <div className="border-destructive/40 rounded-3xl border p-14 text-center text-sm text-red-200">
          {error instanceof Error ? error.message : 'Could not synchronize projects'}
        </div>
      ) : items.length === 0 ? (
        <div className="border-border rounded-[2rem] border-2 border-dashed bg-black/35 py-36 text-center text-sm leading-relaxed text-white shadow-inner shadow-black">
          No active installs right now{' '}
          <span className="text-muted-foreground block pb-12">
            Accept a quotation → convert straight into commissioning.
          </span>
          <Button asChild variant="secondary" className="rounded-full">
            <Link href="/quotations">
              Dive into quotations <ExternalLink className="ml-2 inline h-4 w-4" />
            </Link>
          </Button>
        </div>
      ) : (
        <motion.div
          variants={staggerContainer}
          animate="animate"
          className="grid gap-6 xl:grid-cols-2"
        >
          {items.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </motion.div>
      )}
    </div>
  );
}
