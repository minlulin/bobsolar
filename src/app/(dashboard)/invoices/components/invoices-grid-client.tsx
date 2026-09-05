"use client";

import { format, formatDistanceToNowStrict } from "date-fns";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  FileText,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type React from "react";
import { useMemo, useState } from "react";
import type { InvoiceListRow, InvoiceListSummary } from "@/actions/invoice-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/use-debounce";
import { useInvoices } from "@/hooks/use-invoices";
import { INVOICE_STATUS_BADGE_TONES, INVOICE_STATUS_LABELS } from "@/lib/domain/invoice";
import { cn, formatMMK } from "@/lib/utils";
import type { InvoiceListTab } from "@/lib/validators/invoice";

const PAGE_LIMIT = 20;

interface InvoicesGridClientProps {
  initialData: { items: InvoiceListRow[]; total: number; summary: InvoiceListSummary };
}

function buildTabs(summary: InvoiceListSummary): Array<{ id: InvoiceListTab; label: string }> {
  return [
    { id: "open", label: `Open (${summary.open})` },
    { id: "overdue", label: `Overdue (${summary.overdue})` },
    { id: "draft", label: `Drafts (${summary.draft})` },
    { id: "paid", label: `Paid (${summary.paid})` },
    { id: "all", label: "All" },
  ];
}

function dueLabel(row: InvoiceListRow): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(row.dueDate);
  const diffDays = Math.round((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return "Due today";
  if (diffDays > 0) return `Due in ${diffDays}d`;
  return `${formatDistanceToNowStrict(due)} overdue`;
}

function InvoiceRow({ row }: { row: InvoiceListRow }): React.JSX.Element {
  return (
    <div className="surface-panel flex flex-col gap-4 rounded-2xl border p-5 lg:flex-row lg:items-center lg:justify-between">
      {/* Identity */}
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-bold tracking-tight">{row.invoiceNumber}</span>
          <Badge
            className={cn("border text-[10px] uppercase", INVOICE_STATUS_BADGE_TONES[row.status])}
          >
            {INVOICE_STATUS_LABELS[row.status]}
          </Badge>
          {row.isOverdue ? (
            <Badge className="border-rose-500/50 bg-rose-500/10 text-[10px] text-rose-300 uppercase">
              Overdue
            </Badge>
          ) : null}
        </div>
        <p className="text-muted-foreground truncate text-sm font-medium">
          {row.customerName} · <span className="font-mono text-xs">{row.projectNumber}</span>
        </p>
        <p className="text-muted-foreground text-xs">
          Invoiced {format(new Date(row.invoiceDate), "MMM dd, yyyy")} · Due{" "}
          {format(new Date(row.dueDate), "MMM dd, yyyy")}
          {row.isOverdue || row.status === "unpaid" || row.status === "partial" ? (
            <span className={cn("font-semibold", row.isOverdue ? "text-rose-300" : "")}>
              {" "}
              · {dueLabel(row)}
            </span>
          ) : null}
        </p>
      </div>

      {/* Money */}
      <div className="flex items-center justify-between gap-6 lg:justify-end">
        <div className="text-right">
          <p className="text-muted-foreground text-[10px] font-bold uppercase">Total</p>
          <p className="font-mono text-base font-bold">{formatMMK(row.total)}</p>
          {row.status === "partial" ? (
            <p className="text-emerald-300 font-mono text-xs">paid {formatMMK(row.paidAmount)}</p>
          ) : null}
        </div>
        <div className="text-right">
          <p className="text-muted-foreground text-[10px] font-bold uppercase">Balance</p>
          <p
            className={cn(
              "font-mono text-base font-bold",
              row.balanceDue > 0 && row.isPosted ? "text-amber-300" : "text-muted-foreground",
            )}
          >
            {formatMMK(row.balanceDue)}
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="rounded-full">
          <Link
            href={`/projects/${row.projectId}`}
            aria-label={`Open project ${row.projectNumber}`}
          >
            Open project
          </Link>
        </Button>
      </div>
    </div>
  );
}

export function InvoicesGridClient({ initialData }: InvoicesGridClientProps): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<InvoiceListTab>("open");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const pageParam = Number(searchParams.get("page") ?? "1");
  const currentPage = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;

  const queryFilters = useMemo(
    () => ({
      tab,
      search: debouncedSearch || undefined,
      page: currentPage,
      limit: PAGE_LIMIT,
    }),
    [tab, debouncedSearch, currentPage],
  );

  const isDefault = tab === "open" && !debouncedSearch && currentPage === 1;
  const {
    data: response,
    isLoading,
    isError,
    error,
  } = useInvoices(queryFilters, isDefault ? initialData : undefined);

  const invoices = response?.items ?? [];
  const total = response?.total ?? 0;
  const summary = response?.summary ?? initialData.summary;
  const hasPrevious = currentPage > 1;
  const hasNext = currentPage * PAGE_LIMIT < total;

  const navigatePage = (nextPage: number): void => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(nextPage));
    router.push(`/invoices?${params.toString()}`);
  };

  return (
    <div className="space-y-8 pb-32">
      {/* Header */}
      <div className="surface-panel flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <h1 className="font-heading text-foreground text-3xl font-bold tracking-tight">
            Invoices
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Every issued invoice across all projects — chase payments from one place.
          </p>
          {summary.open > 0 ? (
            <p className="text-muted-foreground mt-2 text-xs font-medium">
              <span className="font-mono font-bold text-amber-300">
                {formatMMK(summary.openBalanceTotal)}
              </span>{" "}
              outstanding across {summary.open} open invoice
              {summary.open === 1 ? "" : "s"}
              {summary.overdue > 0 ? (
                <>
                  {" · "}
                  <span className="font-bold text-rose-300">{summary.overdue} overdue</span>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
        <div className="bg-secondary/50 border-border/70 flex items-center gap-3 self-start rounded-full border px-4 py-2 text-xs font-medium sm:self-center">
          <CircleDollarSign className="text-accent h-4 w-4" />
          <span>
            {summary.draft} draft{summary.draft === 1 ? "" : "s"} awaiting posting
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="surface-panel-muted flex flex-col gap-3 rounded-2xl border p-3">
        <div className="flex gap-2 overflow-x-auto">
          {buildTabs(summary).map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setTab(item.id);
                  // Tab switch resets pagination — page 1 of the new tab.
                  if (currentPage !== 1) {
                    const params = new URLSearchParams(searchParams.toString());
                    params.delete("page");
                    router.push(`/invoices?${params.toString()}`);
                  }
                }}
                className={`rounded-xl border px-4 py-2 text-[11px] font-semibold whitespace-nowrap uppercase transition-colors ${
                  active
                    ? "border-border bg-background text-foreground shadow-sm"
                    : "text-muted-foreground border-transparent hover:bg-background/70 hover:text-foreground"
                } ${item.id === "overdue" && summary.overdue > 0 ? "text-rose-400" : ""}`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="relative w-full max-w-md">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search by invoice, project number or customer..."
            className="bg-background/80 pl-10"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
            }}
          />
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton rows
              key={index}
              className="bg-muted/40 border-border/60 h-24 animate-pulse rounded-2xl border"
            />
          ))}
        </div>
      ) : isError ? (
        <div className="border-destructive/50 bg-destructive/5 flex flex-col items-center justify-center rounded-2xl border py-24 text-center">
          <div className="bg-destructive/10 mb-4 rounded-full p-4">
            <AlertCircle className="text-destructive h-12 w-12" />
          </div>
          <h3 className="text-destructive text-xl font-semibold">Failed to load invoices</h3>
          <p className="text-muted-foreground mt-2 max-w-xs">
            {error?.message ?? "An unexpected error occurred while fetching invoices."}
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => {
              setSearch("");
              router.refresh();
            }}
          >
            Clear Search & Retry
          </Button>
        </div>
      ) : invoices.length > 0 ? (
        <div className="space-y-3">
          {invoices.map((row) => (
            <InvoiceRow key={row.id} row={row} />
          ))}
        </div>
      ) : (
        <div className="border-border/60 bg-muted/35 flex flex-col items-center justify-center rounded-2xl border border-dashed py-24 text-center">
          <div className="text-muted-foreground bg-background/70 border-border/60 flex h-20 w-20 items-center justify-center rounded-2xl border">
            <FileText className="h-10 w-10 opacity-20" />
          </div>
          <h3 className="text-foreground mt-6 text-xl font-semibold">
            {tab === "overdue"
              ? "Nothing overdue"
              : tab === "open"
                ? "No open invoices"
                : "No invoices here"}
          </h3>
          <p className="text-muted-foreground mt-2 max-w-xs">
            {search
              ? "We couldn't find any invoices matching your search criteria."
              : tab === "overdue"
                ? "Every open invoice is still within its due date. Nice."
                : "Invoices are created from a completed project's detail page."}
          </p>
        </div>
      )}

      {/* Pagination */}
      {total > PAGE_LIMIT && (
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-xs font-medium">
            Page {currentPage} · {total} invoices
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!hasPrevious}
              onClick={() => {
                navigatePage(currentPage - 1);
              }}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasNext}
              onClick={() => {
                navigatePage(currentPage + 1);
              }}
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
