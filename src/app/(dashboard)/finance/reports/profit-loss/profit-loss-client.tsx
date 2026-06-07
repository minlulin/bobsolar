"use client";

import { format } from "date-fns";
import { ArrowDown, ArrowUp, Calendar, Download, TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";
import type { ProfitLossReport } from "@/actions/profit-loss-actions";
import { BackButton } from "@/components/shared/back-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMMK } from "@/lib/utils";

interface ProfitLossReportClientProps {
  initialReport: ProfitLossReport | null;
}

export function ProfitLossReportClient({
  initialReport,
}: ProfitLossReportClientProps): React.JSX.Element {
  const [dateFrom, setDateFrom] = useState(
    initialReport?.periodStart ?? format(new Date(new Date().getFullYear(), 0, 1), "yyyy-MM-dd"),
  );
  const [dateTo, setDateTo] = useState(
    initialReport?.periodEnd ?? format(new Date(), "yyyy-MM-dd"),
  );
  const [report, setReport] = useState<ProfitLossReport | null>(initialReport);
  const [isLoading, setIsLoading] = useState(false);

  const handleFetch = async () => {
    setIsLoading(true);
    try {
      const { getProfitLossReport } = await import("@/actions/profit-loss-actions");
      const result = await getProfitLossReport({ dateFrom, dateTo });
      if (result.success) {
        setReport(result.data);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!report) return;

    const rows = [
      ["Profit & Loss Report", ""],
      [`Period: ${report.periodStart} to ${report.periodEnd}`, ""],
      [],
      ["Income", ""],
      ...report.income.items.map((item) => [item.accountName, item.amount.toString()]),
      ["Total Income", report.income.total.toString()],
      [],
      ["Cost of Goods Sold", ""],
      ...report.cogs.items.map((item) => [item.accountName, item.amount.toString()]),
      ["Total COGS", report.cogs.total.toString()],
      [],
      ["Gross Profit", report.grossProfit.toString()],
      ["Gross Margin", `${report.grossMargin}%`],
      [],
      ["Operating Expenses", ""],
      ...report.expense.items.map((item) => [item.accountName, item.amount.toString()]),
      ["Total Operating Expenses", report.expense.total.toString()],
      [],
      ["Net Profit", report.netProfit.toString()],
      ["Net Margin", `${report.netMargin}%`],
    ];

    const csv = rows.map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `profit-loss-${report.periodStart}-${report.periodEnd}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <BackButton />
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Profit & Loss Report
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Income and expense breakdown for the selected period.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-auto"
          />
          <span className="text-muted-foreground text-sm">to</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-auto"
          />
          <button
            type="button"
            onClick={handleFetch}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-md bg-(--color-deep-navy) px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-(--color-deep-navy)/90 disabled:opacity-50"
          >
            <Calendar className="h-4 w-4" />
            {isLoading ? "Loading..." : "Apply"}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
        <SummaryMetric
          label="Total Income"
          value={report?.income.total ?? 0}
          icon={TrendingUp}
          color="text-emerald-600"
          isLoading={isLoading}
        />
        <SummaryMetric
          label="COGS"
          value={report?.cogs.total ?? 0}
          icon={TrendingDown}
          color="text-orange-600"
          isLoading={isLoading}
        />
        <SummaryMetric
          label="Gross Profit"
          value={report?.grossProfit ?? 0}
          icon={(report?.grossProfit ?? 0) >= 0 ? TrendingUp : TrendingDown}
          color={(report?.grossProfit ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600"}
          isLoading={isLoading}
          showSign
        />
        <SummaryMetric
          label="Operating Expenses"
          value={report?.expense.total ?? 0}
          icon={TrendingDown}
          color="text-rose-600"
          isLoading={isLoading}
        />
        <SummaryMetric
          label="Net Profit"
          value={report?.netProfit ?? 0}
          icon={(report?.netProfit ?? 0) >= 0 ? TrendingUp : TrendingDown}
          color={(report?.netProfit ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600"}
          isLoading={isLoading}
          showSign
        />
      </div>

      {/* Report Table */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Detailed Breakdown</CardTitle>
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={!report}
              className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 8 }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholder
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          ) : report ? (
            <div className="space-y-6">
              {/* Income Section */}
              <section>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-700">
                  <ArrowUp className="h-4 w-4" />
                  Income
                </h3>
                <div className="space-y-1">
                  {report.income.items.length > 0 ? (
                    report.income.items.map((item) => (
                      <div
                        key={item.accountCode}
                        className="flex items-center justify-between rounded-md px-3 py-2 text-sm"
                      >
                        <span className="text-foreground">{item.accountName}</span>
                        <span className="font-medium tabular-nums text-emerald-700">
                          {formatMMK(item.amount)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground py-4 text-center text-sm">
                      No income recorded for this period.
                    </p>
                  )}
                  <div className="border-border border-t pt-2">
                    <div className="flex items-center justify-between rounded-md bg-emerald-50 px-3 py-2 text-sm font-semibold">
                      <span>Total Income</span>
                      <span className="tabular-nums text-emerald-700">
                        {formatMMK(report.income.total)}
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              {/* COGS Section */}
              <section>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-orange-700">
                  <ArrowDown className="h-4 w-4" />
                  Cost of Goods Sold
                </h3>
                <div className="space-y-1">
                  {report.cogs.items.length > 0 ? (
                    report.cogs.items.map((item) => (
                      <div
                        key={item.accountCode}
                        className="flex items-center justify-between rounded-md px-3 py-2 text-sm"
                      >
                        <span className="text-foreground">{item.accountName}</span>
                        <span className="font-medium tabular-nums text-orange-700">
                          {formatMMK(item.amount)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground py-4 text-center text-sm">
                      No COGS recorded for this period.
                    </p>
                  )}
                  <div className="border-border border-t pt-2">
                    <div className="flex items-center justify-between rounded-md bg-orange-50 px-3 py-2 text-sm font-semibold">
                      <span>Total COGS</span>
                      <span className="tabular-nums text-orange-700">
                        {formatMMK(report.cogs.total)}
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Gross Profit Subtotal */}
              <div className="border-border rounded-lg border bg-blue-50 p-4">
                <div className="flex items-center justify-between text-base font-bold">
                  <span>Gross Profit</span>
                  <span className={report.grossProfit >= 0 ? "text-emerald-700" : "text-rose-700"}>
                    {formatMMK(report.grossProfit)}
                    <span className="text-muted-foreground ml-2 text-sm font-normal">
                      ({report.grossMargin}% margin)
                    </span>
                  </span>
                </div>
              </div>

              {/* Expense Section */}
              <section>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-rose-700">
                  <ArrowDown className="h-4 w-4" />
                  Operating Expenses
                </h3>
                <div className="space-y-1">
                  {report.expense.items.length > 0 ? (
                    report.expense.items.map((item) => (
                      <div
                        key={item.accountCode}
                        className="flex items-center justify-between rounded-md px-3 py-2 text-sm"
                      >
                        <span className="text-foreground">{item.accountName}</span>
                        <span className="font-medium tabular-nums text-rose-700">
                          {formatMMK(item.amount)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground py-4 text-center text-sm">
                      No expenses recorded for this period.
                    </p>
                  )}
                  <div className="border-border border-t pt-2">
                    <div className="flex items-center justify-between rounded-md bg-rose-50 px-3 py-2 text-sm font-semibold">
                      <span>Total Operating Expenses</span>
                      <span className="tabular-nums text-rose-700">
                        {formatMMK(report.expense.total)}
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Net Profit Summary */}
              <div className="border-border rounded-lg border bg-slate-50 p-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Gross Margin</span>
                    <span className="font-semibold tabular-nums">{report.grossMargin}%</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Net Margin</span>
                    <span className="font-semibold tabular-nums">{report.netMargin}%</span>
                  </div>
                  <div className="border-border border-t pt-2">
                    <div className="flex items-center justify-between text-base font-bold">
                      <span>Net Profit / (Loss)</span>
                      <span
                        className={report.netProfit >= 0 ? "text-emerald-700" : "text-rose-700"}
                      >
                        {report.netProfit >= 0 ? "+" : ""}
                        {formatMMK(report.netProfit)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground py-8 text-center text-sm">
              Select a date range and click Apply to generate the report.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface SummaryMetricProps {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  isLoading: boolean;
  showSign?: boolean;
}

function SummaryMetric({
  label,
  value,
  icon: Icon,
  color,
  isLoading,
  showSign,
}: SummaryMetricProps): React.JSX.Element {
  return (
    <Card className="border-border transition-shadow hover:shadow-sm">
      <CardContent className="p-5">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-7 w-28" />
          </div>
        ) : (
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                {label}
              </p>
              <p className={`text-xl font-bold tabular-nums ${color}`}>
                {showSign && value >= 0 ? "+" : showSign && value < 0 ? "-" : ""}
                {formatMMK(Math.abs(value))}
              </p>
            </div>
            <div
              className={`rounded-lg p-2 ${color.includes("emerald") ? "bg-emerald-50" : "bg-rose-50"}`}
            >
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
