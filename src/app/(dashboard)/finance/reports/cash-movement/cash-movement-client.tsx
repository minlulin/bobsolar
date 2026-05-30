"use client";

import { format } from "date-fns";
import { ArrowLeftRight, Calendar, Download, Landmark, Wallet } from "lucide-react";
import { useState } from "react";
import type { CashMovementReport } from "@/actions/cash-movement-actions";
import { BackButton } from "@/components/shared/back-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMMK } from "@/lib/utils";

interface CashMovementReportClientProps {
  initialReport: CashMovementReport | null;
}

export function CashMovementReportClient({
  initialReport,
}: CashMovementReportClientProps): React.JSX.Element {
  const [dateFrom, setDateFrom] = useState(
    initialReport?.periodStart ?? format(new Date(new Date().getFullYear(), 0, 1), "yyyy-MM-dd"),
  );
  const [dateTo, setDateTo] = useState(
    initialReport?.periodEnd ?? format(new Date(), "yyyy-MM-dd"),
  );
  const [report, setReport] = useState<CashMovementReport | null>(initialReport);
  const [isLoading, setIsLoading] = useState(false);

  const handleFetch = async () => {
    setIsLoading(true);
    try {
      const { getCashMovementReport } = await import("@/actions/cash-movement-actions");
      const result = await getCashMovementReport({ dateFrom, dateTo });
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
      ["Cash Movement Report", ""],
      [`Period: ${report.periodStart} to ${report.periodEnd}`, ""],
      [],
      ["By Account", ""],
      ["Account", "Opening Balance", "Total In", "Total Out", "Net Movement", "Closing Balance"],
      ...report.byAccount.map((a) => [
        a.accountName,
        a.openingBalance.toString(),
        a.totalIn.toString(),
        a.totalOut.toString(),
        a.netMovement.toString(),
        a.closingBalance.toString(),
      ]),
      [],
      ["By Payment Method", ""],
      ["Method", "Total In", "Total Out", "Net Movement"],
      ...report.byMethod.map((m) => [
        m.methodName,
        m.totalIn.toString(),
        m.totalOut.toString(),
        m.netMovement.toString(),
      ]),
      [],
      ["Summary", ""],
      ["Total In", report.totalIn.toString()],
      ["Total Out", report.totalOut.toString()],
      ["Net Movement", report.netMovement.toString()],
    ];

    const csv = rows.map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cash-movement-${report.periodStart}-${report.periodEnd}.csv`;
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
            Cash Movement Report
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Cash inflows and outflows by account and payment method.
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
            className="inline-flex items-center gap-2 rounded-md bg-[var(--color-deep-navy)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-deep-navy)]/90 disabled:opacity-50"
          >
            <Calendar className="h-4 w-4" />
            {isLoading ? "Loading..." : "Apply"}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryMetric
          label="Total Cash In"
          value={report?.totalIn ?? 0}
          icon={ArrowLeftRight}
          color="text-emerald-600"
          isLoading={isLoading}
        />
        <SummaryMetric
          label="Total Cash Out"
          value={report?.totalOut ?? 0}
          icon={ArrowLeftRight}
          color="text-rose-600"
          isLoading={isLoading}
        />
        <SummaryMetric
          label="Net Movement"
          value={report?.netMovement ?? 0}
          icon={ArrowLeftRight}
          color={(report?.netMovement ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600"}
          isLoading={isLoading}
          showSign
        />
      </div>

      {/* By Account Table */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Landmark className="text-muted-foreground h-4 w-4" />
              Cash Movement by Account
            </CardTitle>
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
            <div className="space-y-3">
              {Array.from({ length: 5 }).map(() => (
                <Skeleton key={crypto.randomUUID()} className="h-8 w-full" />
              ))}
            </div>
          ) : report && report.byAccount.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-border border-b">
                    <th className="pb-2 text-left font-medium text-muted-foreground">Account</th>
                    <th className="pb-2 text-right font-medium text-muted-foreground">
                      Opening Balance
                    </th>
                    <th className="pb-2 text-right font-medium text-emerald-700">Total In</th>
                    <th className="pb-2 text-right font-medium text-rose-700">Total Out</th>
                    <th className="pb-2 text-right font-medium text-muted-foreground">
                      Net Movement
                    </th>
                    <th className="pb-2 text-right font-medium text-foreground">Closing Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {report.byAccount.map((account) => (
                    <tr key={account.accountCode} className="border-border border-b last:border-0">
                      <td className="py-2.5 text-foreground">{account.accountName}</td>
                      <td className="py-2.5 text-right tabular-nums">
                        {formatMMK(account.openingBalance)}
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-emerald-700">
                        {formatMMK(account.totalIn)}
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-rose-700">
                        {formatMMK(account.totalOut)}
                      </td>
                      <td
                        className={`py-2.5 text-right tabular-nums ${account.netMovement >= 0 ? "text-emerald-700" : "text-rose-700"}`}
                      >
                        {account.netMovement >= 0 ? "+" : ""}
                        {formatMMK(account.netMovement)}
                      </td>
                      <td className="py-2.5 text-right font-medium tabular-nums">
                        {formatMMK(account.closingBalance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted-foreground py-8 text-center text-sm">
              No cash movement data for this period.
            </p>
          )}
        </CardContent>
      </Card>

      {/* By Payment Method Table */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Wallet className="text-muted-foreground h-4 w-4" />
            Cash Movement by Payment Method
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map(() => (
                <Skeleton key={crypto.randomUUID()} className="h-8 w-full" />
              ))}
            </div>
          ) : report && report.byMethod.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-border border-b">
                    <th className="pb-2 text-left font-medium text-muted-foreground">Method</th>
                    <th className="pb-2 text-right font-medium text-emerald-700">Total In</th>
                    <th className="pb-2 text-right font-medium text-rose-700">Total Out</th>
                    <th className="pb-2 text-right font-medium text-muted-foreground">
                      Net Movement
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {report.byMethod.map((method) => (
                    <tr key={method.methodName} className="border-border border-b last:border-0">
                      <td className="py-2.5 text-foreground">{method.methodName}</td>
                      <td className="py-2.5 text-right tabular-nums text-emerald-700">
                        {formatMMK(method.totalIn)}
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-rose-700">
                        {formatMMK(method.totalOut)}
                      </td>
                      <td
                        className={`py-2.5 text-right tabular-nums ${method.netMovement >= 0 ? "text-emerald-700" : "text-rose-700"}`}
                      >
                        {method.netMovement >= 0 ? "+" : ""}
                        {formatMMK(method.netMovement)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted-foreground py-8 text-center text-sm">
              No payment method data for this period.
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
