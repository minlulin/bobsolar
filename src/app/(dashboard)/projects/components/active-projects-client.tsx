"use client";

import type { InferSelectModel } from "drizzle-orm";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import type React from "react";
import { useMemo, useState } from "react";
import type { ProjectListRow } from "@/actions/project-actions";
import { ProjectCard } from "@/components/project/project-card";
import { ListGridSkeleton } from "@/components/skeletons/list-grid-skeleton";
import { Button } from "@/components/ui/button";
import { useProjects } from "@/hooks/use-projects";
import type { projects } from "@/lib/db/schema";
import type { ProjectListFilter } from "@/lib/validators/project";

type ProjectStatus = InferSelectModel<typeof projects>["status"];

const FILTER_GROUPS: Array<{
  id: string;
  label: string;
  status?: ProjectStatus;
}> = [
  { id: "active", label: "All active" },
  { id: "planning", label: "Planning", status: "planning" },
  { id: "in_progress", label: "Live sites", status: "in_progress" },
  { id: "on_hold", label: "On hold", status: "on_hold" },
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
  const [filter, setFilter] = useState<string>("active");

  const queryFilters = useMemo<Partial<ProjectListFilter>>(() => {
    if (filter === "active") return { scope: "active" };

    const found = FILTER_GROUPS.find((pill) => pill.id === filter);
    return {
      scope: "active",
      status: found?.status,
    };
  }, [filter]);

  const isDefault = filter === "active";
  const { data, isLoading, error } = useProjects(queryFilters, isDefault ? initialData : undefined);
  const items = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="surface-panel-muted flex gap-2 overflow-x-auto rounded-2xl border p-2">
        {FILTER_GROUPS.map((pill) => {
          const active = pill.id === filter;

          return (
            <button
              key={pill.id}
              type="button"
              onClick={() => {
                setFilter(pill.id);
              }}
              className={`rounded-xl border px-4 py-2 text-[11px] font-semibold whitespace-nowrap uppercase transition-colors ${
                active
                  ? "border-border bg-background text-foreground shadow-sm"
                  : "text-muted-foreground border-transparent hover:bg-background/70 hover:text-foreground"
              }`}
            >
              {pill.label}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <ListGridSkeleton count={6} />
      ) : error ? (
        <div className="border-destructive/40 bg-destructive/5 text-destructive rounded-2xl border p-10 text-center text-sm">
          {error instanceof Error ? error.message : "Could not synchronize projects"}
        </div>
      ) : items.length === 0 ? (
        <div className="border-border/60 bg-muted/35 text-foreground rounded-2xl border border-dashed py-24 text-center text-sm leading-relaxed">
          No active installs right now
          <span className="text-muted-foreground block pb-8">
            Accept a quotation to convert it into commissioning.
          </span>
          <Button asChild variant="secondary" className="rounded-full">
            <Link href="/quotations">
              Open quotations <ExternalLink className="ml-2 inline h-4 w-4" />
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
