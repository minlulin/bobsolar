"use client";

import { format } from "date-fns";
import { BookOpen, Download, Plus } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import type { LedgerPage as LedgerPageType } from "@/actions/ledger-actions";
import { BackButton } from "@/components/shared/back-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccountBalances, useLedgerEntries, useLedgerProjects } from "@/hooks/use-ledger";
import { LEDGER_ACCOUNT_LABELS } from "@/lib/domain/finance";
import type { LedgerFilter } from "@/lib/validators/ledger";
import { JournalEntryRow } from "./journal-entry-row";
import { LedgerBalancesPanel } from "./ledger-balances-panel";
import { LedgerFilterBar } from "./ledger-filter-bar";

interface LedgerPageClientProps {
  initialLedger: LedgerPageType | null;
  initialProjects: { id: string; projectNumber: string }[];
}

const SOURCE_TYPE_LABELS: Record<string, string> = {
  project_payment: "Payment",
  project_expense: "Expense",
  manual_adjustment: "Adjustment",
  opening_balance: "Opening Balance",
  backfill: "Backfill",
};

export function LedgerPageClient({
  initialLedger,
  initialProjects,
}: LedgerPageClientProps): React.JSX.Element {
  const [filters, setFilters] = useState<LedgerFilter>({
    page: 1,
    limit: 50,
  });

  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [showBalances, setShowBalances] = useState(false);

  const { data: ledgerData, isLoading: isLoadingLedger } = useLedgerEntries(
    initialLedger ? { ...filters, page: initialLedger.page, limit: initialLedger.limit } : filters,
  );

  const { data: balancesData, isLoading: isLoadingBalances } = useAccountBalances({
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  });

  const { data: projectsData } = useLedgerProjects();
  const projects = projectsData ?? initialProjects;

  const displayData = ledgerData ?? initialLedger;

  const toggleEntry = useCallback((entryId: string) => {
    setExpandedEntries((prev: Set<string>) => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  }, []);

  const updateFilter = useCallback(
    <K extends keyof LedgerFilter>(key: K, value: LedgerFilter[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
    },
    [],
  );

  const resetFilters = useCallback(() => {
    setFilters({ page: 1, limit: 50 });
  }, []);

  const exportToCSV = useCallback(() => {
    if (!displayData?.entries.length) return;

    const headers = [
      "Date",
      "Entry ID",
      "Source",
      "Memo",
      "Created By",
      "Account",
      "Debit",
      "Credit",
      "Project",
    ];
    const rows: string[][] = [];

    for (const entry of displayData.entries) {
      const baseRow = [
        format(entry.entryDate, "yyyy-MM-dd"),
        entry.entryId.slice(0, 8),
        SOURCE_TYPE_LABELS[entry.sourceType] ?? entry.sourceType,
        entry.memo ?? "",
        entry.creatorName ?? "",
      ];

      for (const line of entry.lines) {
        rows.push([
          ...baseRow,
          LEDGER_ACCOUNT_LABELS[line.accountCode as keyof typeof LEDGER_ACCOUNT_LABELS] ??
            line.accountCode,
          line.debit > 0 ? String(line.debit) : "",
          line.credit > 0 ? String(line.credit) : "",
          line.projectNumber ?? "",
        ]);
      }
    }

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ledger-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [displayData]);

  const hasActiveFilters = Boolean(
    filters.dateFrom ||
      filters.dateTo ||
      filters.accountCode ||
      filters.projectId ||
      filters.sourceType,
  );

  return (
    <div className="space-y-6">
      <BackButton />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Master Ledger
          </h1>
          <p className="text-muted-foreground text-sm">
            Complete journal entry history with double-entry accounting records.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="sm">
            <Link href="/finance/new-entry">
              <Plus className="mr-2 h-4 w-4" />
              New Journal Entry
            </Link>
          </Button>
        </div>
      </div>

      <LedgerFilterBar
        filters={filters}
        projects={projects}
        hasActiveFilters={hasActiveFilters}
        onUpdateFilter={updateFilter}
        onResetFilters={resetFilters}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant={showBalances ? "default" : "outline"}
            size="sm"
            onClick={() => setShowBalances(!showBalances)}
          >
            <BookOpen className="mr-1.5 h-4 w-4" />
            Account Balances
          </Button>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={exportToCSV}
          disabled={!displayData?.entries.length}
        >
          <Download className="mr-1.5 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {showBalances && <LedgerBalancesPanel data={balancesData} isLoading={isLoadingBalances} />}

      {/* Ledger Table */}
      <Card className="border-border">
        <CardContent className="p-0">
          {isLoadingLedger ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholder
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : displayData?.entries.length ? (
            <div className="divide-y">
              {/* Table Header */}
              <div className="bg-muted/30 px-4 py-2.5">
                <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground">
                  <div className="col-span-1"></div>
                  <div className="col-span-2">Date</div>
                  <div className="col-span-2">Source</div>
                  <div className="col-span-3">Memo</div>
                  <div className="col-span-2 text-right">Debit</div>
                  <div className="col-span-2 text-right">Credit</div>
                </div>
              </div>

              {/* Entries */}
              {displayData.entries.map((entry) => (
                <JournalEntryRow
                  key={entry.entryId}
                  entry={entry}
                  isExpanded={expandedEntries.has(entry.entryId)}
                  onToggle={() => toggleEntry(entry.entryId)}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <BookOpen className="text-muted-foreground/50 mb-3 h-12 w-12" />
              <h3 className="font-heading text-base font-semibold text-foreground">
                No ledger entries found
              </h3>
              <p className="text-muted-foreground mt-1 text-sm">
                {hasActiveFilters
                  ? "Try adjusting your filters to see more results."
                  : "Journal entries will appear here once transactions are recorded."}
              </p>
            </div>
          )}

          {/* Pagination */}
          {displayData && displayData.totalPages > 1 && (
            <div className="border-border flex items-center justify-between border-t px-4 py-3">
              <p className="text-muted-foreground text-sm">
                Showing {(displayData.page - 1) * displayData.limit + 1}–
                {Math.min(displayData.page * displayData.limit, displayData.total)} of{" "}
                {displayData.total} entries
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={displayData.page <= 1}
                  onClick={() => updateFilter("page", displayData.page - 1)}
                >
                  Previous
                </Button>
                <span className="text-muted-foreground text-sm tabular-nums">
                  Page {displayData.page} of {displayData.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={displayData.page >= displayData.totalPages}
                  onClick={() => updateFilter("page", displayData.page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
