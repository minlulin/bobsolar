'use client';

import React, { useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useProjects } from '@/hooks/use-projects';
import type { ProjectListFilter } from '@/lib/validators/project';
import { ProjectCard } from '@/components/project/project-card';
import { Button } from '@/components/ui/button';
import type { InferSelectModel } from 'drizzle-orm';
import { projects } from '@/lib/db/schema';
import { ListGridSkeleton } from '@/components/skeletons/list-grid-skeleton';
import type { ProjectListRow } from '@/actions/project-actions';

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

interface ActiveProjectsClientProps {
  initialData: {
    items: ProjectListRow[];
    total: number;
  };
}

export function ActiveProjectsClient({
  initialData,
}: ActiveProjectsClientProps): React.JSX.Element {
  const [filter, setFilter] = useState<string>('active');

  const queryFilters = useMemo<Partial<ProjectListFilter>>(() => {
    if (filter === 'active') return { scope: 'active' };

    const found = FILTER_GROUPS.find((pill) => pill.id === filter);
    return {
      scope: 'active',
      status: found?.status,
    };
  }, [filter]);

  const isDefault = filter === 'active';
  const { data, isLoading, error } = useProjects(
    queryFilters,
    isDefault ? initialData : undefined,
  );
  const items = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex gap-4 overflow-x-auto pb-2">
        {FILTER_GROUPS.map((pill) => {
          const glow = pill.id === filter;

          return (
            <button
              key={pill.id}
              type="button"
              onClick={() => {
                setFilter(pill.id);
              }}
              className={`relative rounded-full border px-6 py-2 text-[11px] font-semibold whitespace-nowrap uppercase transition ${
                glow
                  ? 'border-transparent bg-gradient-to-r from-orange-600/95 to-rose-900/95 text-white shadow-[0_0_24px_-6px_rgb(251,146,60)]'
                  : 'text-muted-foreground border-border/70 hover:bg-muted/60 hover:text-foreground bg-transparent'
              }`}
            >
              <span>{pill.label}</span>
              {glow ? (
                <span className="border-solar absolute inset-0 -z-[1] animate-pulse rounded-full border-[1.5px] opacity-95" />
              ) : null}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <ListGridSkeleton count={6} />
      ) : error ? (
        <div className="border-destructive/40 rounded-3xl border p-14 text-center text-sm text-red-200">
          {error instanceof Error
            ? error.message
            : 'Could not synchronize projects'}
        </div>
      ) : items.length === 0 ? (
        <div className="border-border/70 bg-muted/35 text-foreground rounded-[2rem] border-2 border-dashed py-36 text-center text-sm leading-relaxed shadow-inner">
          No active installs right now{' '}
          <span className="text-muted-foreground block pb-12">
            Accept a quotation → convert straight into commissioning.
          </span>
          <Button asChild variant="secondary" className="rounded-full">
            <Link href="/quotations">
              Dive into quotations{' '}
              <ExternalLink className="ml-2 inline h-4 w-4" />
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          {items.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
