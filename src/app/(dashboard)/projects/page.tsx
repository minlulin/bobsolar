import Link from "next/link";
import type React from "react";
import { getProjects } from "@/actions/project-actions";
import { Button } from "@/components/ui/button";
import { ActiveProjectsClient } from "./components/active-projects-client";

export default async function ActiveProjectsPage(): Promise<React.JSX.Element> {
  const res = await getProjects({ scope: "active" });
  const total = res.success ? res.data.total : 0;
  const initialItems = res.success ? res.data.items : [];

  return (
    <div className="space-y-8">
      <div className="surface-panel flex flex-col gap-4 rounded-2xl border p-5 md:flex-row md:items-start md:justify-between md:p-6">
        <div>
          <h1 className="font-heading text-foreground text-3xl font-bold tracking-tight">
            Active projects
          </h1>
          <p className="text-muted-foreground max-w-xl text-sm leading-relaxed">
            Track live installations, budget movement, and handover readiness from one workspace.
          </p>
          <p className="text-muted-foreground mt-5 text-[11px] font-semibold tracking-[0.24em] uppercase">
            {total} active project{total === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline" className="rounded-full bg-background/70">
            <Link href="/projects/completed">Completed installs</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full bg-background/70">
            <Link href="/warranty">Warranty signals</Link>
          </Button>
        </div>
      </div>

      <ActiveProjectsClient initialData={{ items: initialItems, total }} />
    </div>
  );
}
