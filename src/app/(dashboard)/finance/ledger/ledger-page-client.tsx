"use client";

import { format } from "date-fns";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Download,
  Filter,
  Plus,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import type { LedgerEntryRow, LedgerPage as LedgerPageType } from "@/actions/ledger-actions";
import { BackButton } from "@/components/shared/back-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccountBalances, useLedgerEntries, useLedgerProjects } from "@/hooks/use-ledger";
import {
  JOURNAL_SOURCE_TYPES,
  LEDGER_ACCOUNT_CODES,
  LEDGER_ACCOUNT_LABELS,
} from "@/lib/domain/finance";
import { formatMMK } from "@/lib/utils";
import type { LedgerFilter } from "@/lib/validators/ledger";

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

const SOURCE_TYPE_COLORS: Record<string, string> = {
  project_payment: "bg-emerald-100 text-emerald-700 border-emerald-200",
  project_expense: "bg-rose-100 text-rose-700 border-rose-200",
  manual_adjustment: "bg-amber-100 text-amber-700 border-amber-200",
  opening_balance: "bg-blue-100 text-blue-700 border-blue-200",
  backfill: "bg-slate-100 text-slate-700 border-slate-200",
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

  const hasActiveFilters =
    filters.dateFrom ||
    filters.dateTo ||
    filters.accountCode ||
    filters.projectId ||
    filters.sourceType;

  return (
    <div className="space-y-6">
      <BackButton />
      {/* Header */}
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

      {/* Filters */}
      <Card className="border-border">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="text-muted-foreground h-4 w-4" />
            <span className="text-sm font-medium text-foreground">Filters</span>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="xs"
                onClick={resetFilters}
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
                onChange={(e) => updateFilter("dateFrom", e.target.value || undefined)}
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
                onChange={(e) => updateFilter("dateTo", e.target.value || undefined)}
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
                  updateFilter(
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
                  updateFilter(
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
                onValueChange={(v) => updateFilter("projectId", v === "all" ? undefined : v)}
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

      {/* Action Bar */}
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

      {/* Account Balances Panel */}
      {showBalances && (
        <Card className="border-border">
          <CardContent className="p-4">
            <h3 className="font-heading mb-3 text-sm font-semibold text-foreground">
              Account Balances
            </h3>
            {isLoadingBalances ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map(() => (
                  <Skeleton key={crypto.randomUUID()} className="h-8 w-full" />
                ))}
              </div>
            ) : balancesData?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-border border-b">
                      <th className="text-muted-foreground px-3 py-2 text-left text-xs font-medium">
                        Account
                      </th>
                      <th className="text-muted-foreground px-3 py-2 text-right text-xs font-medium">
                        Type
                      </th>
                      <th className="text-muted-foreground px-3 py-2 text-right text-xs font-medium">
                        Total Debit
                      </th>
                      <th className="text-muted-foreground px-3 py-2 text-right text-xs font-medium">
                        Total Credit
                      </th>
                      <th className="text-muted-foreground px-3 py-2 text-right text-xs font-medium">
                        Balance
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {balancesData.map((row) => (
                      <tr key={row.accountCode} className="border-border border-b last:border-0">
                        <td className="px-3 py-2 font-medium text-foreground">
                          {LEDGER_ACCOUNT_LABELS[
                            row.accountCode as keyof typeof LEDGER_ACCOUNT_LABELS
                          ] ?? row.accountCode}
                        </td>
                        <td className="text-muted-foreground px-3 py-2 text-right capitalize">
                          {row.accountType}
                        </td>
                        <td className="text-emerald-600 px-3 py-2 text-right tabular-nums">
                          {row.totalDebit > 0 ? formatMMK(row.totalDebit) : "—"}
                        </td>
                        <td className="text-rose-600 px-3 py-2 text-right tabular-nums">
                          {row.totalCredit > 0 ? formatMMK(row.totalCredit) : "—"}
                        </td>
                        <td
                          className={`px-3 py-2 text-right tabular-nums font-medium ${row.balance >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                        >
                          {formatMMK(Math.abs(row.balance))}
                          <span className="text-muted-foreground ml-1 text-xs">
                            {row.balance >= 0 ? "Dr" : "Cr"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No balance data for selected period.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Ledger Table */}
      <Card className="border-border">
        <CardContent className="p-0">
          {isLoadingLedger ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map(() => (
                <Skeleton key={crypto.randomUUID()} className="h-12 w-full" />
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

interface JournalEntryRowProps {
  entry: LedgerEntryRow;
  isExpanded: boolean;
  onToggle: () => void;
}

function JournalEntryRow({ entry, isExpanded, onToggle }: JournalEntryRowProps): React.JSX.Element {
  const totalDebit = entry.lines.reduce((sum, l) => sum + l.debit, 0);
  const totalCredit = entry.lines.reduce((sum, l) => sum + l.credit, 0);

  return (
    <div className={entry.isReversed ? "bg-muted/20" : ""}>
      {/* Entry Header */}
      <button
        type="button"
        onClick={onToggle}
        className="hover:bg-muted/30 w-full px-4 py-3 text-left transition-colors"
      >
        <div className="grid grid-cols-12 gap-2 items-center">
          <div className="col-span-1">
            <div className="flex items-center gap-1.5">
              {isExpanded ? (
                <ChevronDown className="text-muted-foreground h-4 w-4" />
              ) : (
                <ChevronRight className="text-muted-foreground h-4 w-4" />
              )}
            </div>
          </div>
          <div className="col-span-2">
            <span className="text-sm font-medium text-foreground tabular-nums">
              {format(entry.entryDate, "MMM d, yyyy")}
            </span>
          </div>
          <div className="col-span-2">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={`text-xs ${SOURCE_TYPE_COLORS[entry.sourceType] ?? "bg-slate-100 text-slate-700 border-slate-200"}`}
              >
                {SOURCE_TYPE_LABELS[entry.sourceType] ?? entry.sourceType}
              </Badge>
              {entry.isReversed && (
                <Badge
                  variant="outline"
                  className="text-xs bg-gray-100 text-gray-500 border-gray-200 line-through"
                >
                  Reversed
                </Badge>
              )}
            </div>
          </div>
          <div className="col-span-3">
            <span className="text-muted-foreground line-clamp-1 text-sm">{entry.memo || "—"}</span>
            {entry.creatorName && (
              <span className="text-muted-foreground/70 ml-1 text-xs">by {entry.creatorName}</span>
            )}
          </div>
          <div className="col-span-2 text-right">
            <span className="text-emerald-600 text-sm font-medium tabular-nums">
              {totalDebit > 0 ? formatMMK(totalDebit) : "—"}
            </span>
          </div>
          <div className="col-span-2 text-right">
            <span className="text-rose-600 text-sm font-medium tabular-nums">
              {totalCredit > 0 ? formatMMK(totalCredit) : "—"}
            </span>
          </div>
        </div>
      </button>

      {/* Expanded Lines */}
      {isExpanded && (
        <div className="bg-muted/10 border-border border-t px-4 py-2">
          <div className="ml-6 space-y-1.5">
            {entry.lines.map((line) => (
              <div key={line.id} className="grid grid-cols-11 gap-2 items-center text-sm">
                <div className="col-span-4">
                  <span className="text-foreground font-medium">
                    {LEDGER_ACCOUNT_LABELS[
                      line.accountCode as keyof typeof LEDGER_ACCOUNT_LABELS
                    ] ?? line.accountCode}
                  </span>
                  {line.projectNumber && (
                    <span className="text-muted-foreground ml-2 text-xs">
                      ({line.projectNumber})
                    </span>
                  )}
                </div>
                <div className="col-span-1 text-right">
                  {line.debit > 0 ? (
                    <span className="text-emerald-600 font-medium tabular-nums">
                      {formatMMK(line.debit)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
                <div className="col-span-1 text-right">
                  {line.credit > 0 ? (
                    <span className="text-rose-600 font-medium tabular-nums">
                      {formatMMK(line.credit)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
                <div className="col-span-5">
                  {line.memo && <span className="text-muted-foreground text-xs">{line.memo}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
