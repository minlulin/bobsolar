'use client';

import { useMemo, useState } from 'react';
import { Loader2, Search as SearchIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { useProjects } from '@/hooks/use-projects';
import type { ProjectListFilter } from '@/lib/validators/project';
import { ProjectCard } from '@/components/project/project-card';
import { staggerContainer } from '@/lib/motion';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function CompletedProjectsPage() {
  const [search, setSearch] = useState('');
  const [year, setYear] = useState<string>('');

  const filters = useMemo<Partial<ProjectListFilter>>(() => {
    return {
      scope: 'completed',
      search,
      year: year ? Number(year) : undefined,
      limit: 60,
      offset: 0,
    };
  }, [search, year]);

  const { data, isLoading, error } = useProjects(filters);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl space-y-3">
          <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.4em] uppercase">
            Archive constellation
          </p>
          <h1 className="font-heading text-3xl font-bold tracking-tight">
            Completed projects
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Post-handover dossiers highlighting spend variance versus proposal
            plus live warranty choreography.
          </p>
          <p className="text-muted-foreground text-xs font-semibold uppercase">
            {total} dossier block{total === 1 ? '' : 's'}
          </p>
        </div>
        <Button asChild variant="outline" className="rounded-full">
          <Link href="/projects">Back to active installs</Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-6">
        <div className="relative w-full max-w-md flex-1">
          <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            className="pl-11"
            placeholder="Search PJ number · customer surname"
            value={search}
            onChange={(e) => { setSearch(e.target.value); }}
          />
        </div>
        <div className="flex items-center gap-3">
          <label className="text-muted-foreground text-[11px] font-semibold uppercase">
            Completed year filter
          </label>
          <Input
            className="w-32 rounded-full bg-black/55"
            type="number"
            placeholder="YYYY"
            value={year}
            onChange={(e) => { setYear(e.target.value); }}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-[52vh] items-center justify-center">
          <Loader2 className="text-solar h-10 w-10 animate-spin" />
        </div>
      ) : error ? (
        <div className="border-destructive/40 rounded-3xl border p-14 text-center text-red-300">
          {error instanceof Error ? error.message : 'Historical grid offline'}
        </div>
      ) : items.length === 0 ? (
        <div className="text-muted-foreground rounded-[2rem] border border-dashed border-white/15 py-36 text-center text-sm">
          No records match · tweak filters?
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
