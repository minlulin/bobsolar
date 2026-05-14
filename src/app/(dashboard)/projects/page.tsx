import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getProjects } from '@/actions/project-actions';
import { ActiveProjectsClient } from './components/active-projects-client';

export default async function ActiveProjectsPage(): Promise<React.JSX.Element> {
  const res = await getProjects({ scope: 'active' });
  const total = res.success ? res.data.total : 0;
  const initialItems = res.success ? res.data.items : [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tighter">
            Active projects
          </h1>
          <p className="text-muted-foreground max-w-xl text-sm leading-relaxed">
            Each card syncs quotations, budgeting, crews, and aftercare
            touchpoints — orbit through status chips to tighten your focus
            radius.
          </p>
          <p className="text-muted-foreground mt-6 text-[12px] font-semibold tracking-[0.45em] uppercase">
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

      <ActiveProjectsClient initialData={{ items: initialItems, total }} />
    </div>
  );
}
