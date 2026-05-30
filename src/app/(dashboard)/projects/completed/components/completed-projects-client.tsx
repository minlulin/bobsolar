"use client";

import { Loader2, Search as SearchIcon } from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";
import type { ProjectListRow } from "@/actions/project-actions";
import { ProjectCard } from "@/components/project/project-card";
import { Input } from "@/components/ui/input";
import { useProjects } from "@/hooks/use-projects";
import type { ProjectListFilter } from "@/lib/validators/project";

interface CompletedProjectsClientProps {
  initialData: {
    items: ProjectListRow[];
    total: number;
  };
}

export function CompletedProjectsClient({
  initialData,
}: CompletedProjectsClientProps): React.JSX.Element {
  const [search, setSearch] = useState("");
  const [year, setYear] = useState<string>("");
  const currentYear = new Date().getFullYear();

  function normalizeYearInput(value: string): string {
    const trimmed = value.trim();
    if (trimmed.length === 0) return "";
    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(parsed)) return "";
    const clamped = Math.max(2000, Math.min(currentYear, parsed));
    return String(clamped);
  }

  const filters = useMemo<Partial<ProjectListFilter>>(() => {
    return {
      scope: "completed",
      search,
      year: year ? Number(year) : undefined,
      limit: 60,
      offset: 0,
    };
  }, [search, year]);

  const isDefault = !search && !year;
  const { data, isLoading, error } = useProjects(filters, isDefault ? initialData : undefined);

  const items = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <div className="relative w-full max-w-md flex-1">
          <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            className="pl-11"
            placeholder="Search PJ number · customer surname"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
            }}
          />
        </div>
        <div className="flex items-center gap-3">
          <label
            htmlFor="completed-year-filter"
            className="text-muted-foreground text-[11px] font-semibold uppercase"
          >
            Completed year filter
          </label>
          <Input
            id="completed-year-filter"
            className="bg-card/80 w-32 rounded-full"
            type="number"
            placeholder="YYYY"
            value={year}
            onChange={(e) => {
              setYear(e.target.value);
            }}
            onBlur={(e) => {
              setYear(normalizeYearInput(e.target.value));
            }}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-[52vh] items-center justify-center">
          <Loader2 className="text-solar h-10 w-10 animate-spin" />
        </div>
      ) : error ? (
        <div className="border-destructive/40 text-destructive rounded-3xl border p-14 text-center">
          {error instanceof Error ? error.message : "Historical grid offline"}
        </div>
      ) : items.length === 0 ? (
        <div className="text-muted-foreground border-border/70 rounded-[2rem] border border-dashed py-36 text-center text-sm">
          No records match · tweak filters?
        </div>
      ) : (
        <div className="grid gap-2 xl:grid-cols-2">
          {items.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
