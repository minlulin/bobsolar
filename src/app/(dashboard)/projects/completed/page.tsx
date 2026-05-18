import Link from "next/link";
import type React from "react";
import { getProjects } from "@/actions/project-actions";
import { Button } from "@/components/ui/button";
import { CompletedProjectsClient } from "./components/completed-projects-client";

export default async function CompletedProjectsPage(): Promise<React.JSX.Element> {
  const res = await getProjects({ scope: "completed", limit: 60, offset: 0 });
  const total = res.success ? res.data.total : 0;
  const initialItems = res.success ? res.data.items : [];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl space-y-3">
          <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.4em] uppercase">
            Archive constellation
          </p>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Completed projects</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Post-handover dossiers highlighting spend variance versus proposal plus live warranty
            choreography.
          </p>
          <p className="text-muted-foreground text-xs font-semibold uppercase">
            {total} dossier block{total === 1 ? "" : "s"}
          </p>
        </div>
        <Button asChild variant="outline" className="rounded-full">
          <Link href="/projects">Back to active installs</Link>
        </Button>
      </div>

      <CompletedProjectsClient initialData={{ items: initialItems, total }} />
    </div>
  );
}
