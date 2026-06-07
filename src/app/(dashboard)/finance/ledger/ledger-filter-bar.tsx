"use client";

import { Filter, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  JOURNAL_SOURCE_TYPES,
  LEDGER_ACCOUNT_CODES,
  LEDGER_ACCOUNT_LABELS,
} from "@/lib/domain/finance";
import type { LedgerFilter } from "@/lib/validators/ledger";

const SOURCE_TYPE_LABELS: Record<string, string> = {
  project_payment: "Payment",
  project_expense: "Expense",
  manual_adjustment: "Adjustment",
  opening_balance: "Opening Balance",
  backfill: "Backfill",
};

interface LedgerFilterBarProps {
  filters: LedgerFilter;
  projects: { id: string; projectNumber: string }[];
  hasActiveFilters: boolean;
  onUpdateFilter: <K extends keyof LedgerFilter>(key: K, value: LedgerFilter[K]) => void;
  onResetFilters: () => void;
}

export function LedgerFilterBar({
  filters,
  projects,
  hasActiveFilters,
  onUpdateFilter,
  onResetFilters,
}: LedgerFilterBarProps): React.JSX.Element {
  return (
    <Card className="border-border">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="text-muted-foreground h-4 w-4" />
          <span className="text-sm font-medium text-foreground">Filters</span>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="xs"
              onClick={onResetFilters}
              className="ml-auto h-6 px-2 text-xs"
            >
              <RotateCcw className="mr-1 h-3 w-3" />
              Reset
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <label htmlFor="date-from" className="text-xs font-medium text-muted-foreground">
              Date From
            </label>
            <input
              id="date-from"
              type="date"
              value={filters.dateFrom ?? ""}
              onChange={(e) => onUpdateFilter("dateFrom", e.target.value || undefined)}
              className="border-input focus-visible:ring-ring h-8 w-full rounded-md border bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-1"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="date-to" className="text-xs font-medium text-muted-foreground">
              Date To
            </label>
            <input
              id="date-to"
              type="date"
              value={filters.dateTo ?? ""}
              onChange={(e) => onUpdateFilter("dateTo", e.target.value || undefined)}
              className="border-input focus-visible:ring-ring h-8 w-full rounded-md border bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-1"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="account-filter" className="text-xs font-medium text-muted-foreground">
              Account
            </label>
            <Select
              value={filters.accountCode ?? "all"}
              onValueChange={(v) =>
                onUpdateFilter(
                  "accountCode",
                  v === "all" ? undefined : (v as LedgerFilter["accountCode"]),
                )
              }
            >
              <SelectTrigger size="sm" id="account-filter">
                <SelectValue placeholder="All accounts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All accounts</SelectItem>
                {LEDGER_ACCOUNT_CODES.map((code) => (
                  <SelectItem key={code} value={code}>
                    {LEDGER_ACCOUNT_LABELS[code]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="source-type" className="text-xs font-medium text-muted-foreground">
              Source Type
            </label>
            <Select
              value={filters.sourceType ?? "all"}
              onValueChange={(v) =>
                onUpdateFilter(
                  "sourceType",
                  v === "all" ? undefined : (v as LedgerFilter["sourceType"]),
                )
              }
            >
              <SelectTrigger size="sm" id="source-type">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {JOURNAL_SOURCE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {SOURCE_TYPE_LABELS[type] ?? type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="project-filter" className="text-xs font-medium text-muted-foreground">
              Project
            </label>
            <Select
              value={filters.projectId ?? "all"}
              onValueChange={(v) => onUpdateFilter("projectId", v === "all" ? undefined : v)}
            >
              <SelectTrigger size="sm" id="project-filter">
                <SelectValue placeholder="All projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.projectNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
