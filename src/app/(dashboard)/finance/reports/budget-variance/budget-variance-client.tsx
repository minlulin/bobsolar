"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  Plus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import {
  type BudgetReport,
  type BudgetWithVariance,
  getBudgetReport,
} from "@/actions/budget-actions";
import { BackButton } from "@/components/shared/back-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { type BudgetVarianceFilter, reportKeys } from "@/lib/query-keys";
import { formatMMK } from "@/lib/utils";

interface BudgetVarianceClientProps {
  initialReport: BudgetReport | null;
}

export function BudgetVarianceClient({
  initialReport,
}: BudgetVarianceClientProps): React.JSX.Element {
  const [periodFilter, setPeriodFilter] = useState<BudgetVarianceFilter>({});

  const { data: report, isLoading } = useQuery({
    queryKey: reportKeys.budgetVariance(periodFilter),
    queryFn: async () => {
      const result = await getBudgetReport(periodFilter);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    initialData: initialReport ?? undefined,
    staleTime: 30 * 1000,
  });

  const handlePeriodChange = useCallback((value: string) => {
    const year = new Date().getFullYear();
    switch (value) {
      case "q1":
        setPeriodFilter({ periodStart: `${year}-01-01`, periodEnd: `${year}-03-31` });
        break;
      case "q2":
        setPeriodFilter({ periodStart: `${year}-04-01`, periodEnd: `${year}-06-30` });
        break;
      case "q3":
        setPeriodFilter({ periodStart: `${year}-07-01`, periodEnd: `${year}-09-30` });
        break;
      case "q4":
        setPeriodFilter({ periodStart: `${year}-10-01`, periodEnd: `${year}-12-31` });
        break;
      default:
        setPeriodFilter({ periodStart: `${year}-01-01`, periodEnd: `${year}-12-31` });
        break;
    }
  }, []);

  const handleExportCSV = () => {
    if (!report) return;

    const rows = [
      ["Budget vs Actual Report", ""],
      [`Period: ${report.periodStart} to ${report.periodEnd}`, ""],
      [],
      ["Account", "Budget", "Actual", "Variance", "Variance %", "Status", "Notes"],
      ...report.accounts.map((a) => [
        a.accountLabel,
        a.budgetAmount.toString(),
        a.actualAmount.toString(),
        a.variance.toString(),
        `${a.variancePercent}%`,
        a.status,
        a.notes ?? "",
      ]),
      [],
      [
        "Total",
        report.totalBudget.toString(),
        report.totalActual.toString(),
        report.totalVariance.toString(),
        "",
        "",
        "",
      ],
    ];

    const csv = rows.map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `budget-variance-${report.periodStart}-to-${report.periodEnd}.csv`;
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
            Budget vs Actual
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Compare budgeted amounts against actual expenses by account.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/finance/reports">
              <ArrowLeft className="mr-2 h-4 w-4" />
              All Reports
            </Link>
          </Button>
          <Select defaultValue="full_year" onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="full_year">Full Year</SelectItem>
              <SelectItem value="q1">Q1 (Jan-Mar)</SelectItem>
              <SelectItem value="q2">Q2 (Apr-Jun)</SelectItem>
              <SelectItem value="q3">Q3 (Jul-Sep)</SelectItem>
              <SelectItem value="q4">Q4 (Oct-Dec)</SelectItem>
            </SelectContent>
          </Select>
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={!report}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            CSV
          </button>
        </div>
      </div>

      {isLoading && !report ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : !report ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <AlertTriangle className="text-muted-foreground/50 mb-2 h-8 w-8" />
          <p className="text-muted-foreground text-sm">Unable to load budget data.</p>
        </div>
      ) : (
        <>
          {/* Summary */}
          <Card className="border-border bg-slate-50">
            <CardContent className="p-5">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-muted-foreground text-xs">Total Budget</p>
                  <p className="text-foreground text-lg font-bold tabular-nums">
                    {formatMMK(report.totalBudget)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Total Actual</p>
                  <p className="text-lg font-bold tabular-nums">
                    {report.totalActual > report.totalBudget ? (
                      <span className="text-rose-600">{formatMMK(report.totalActual)}</span>
                    ) : (
                      <span className="text-emerald-600">{formatMMK(report.totalActual)}</span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Variance</p>
                  <p
                    className={`text-lg font-bold tabular-nums ${
                      report.totalVariance > 0 ? "text-rose-600" : "text-emerald-600"
                    }`}
                  >
                    {report.totalVariance > 0 ? "+" : ""}
                    {formatMMK(report.totalVariance)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Budget Table */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base font-semibold">
                <span className="flex items-center gap-2">
                  <TrendingDown className="text-muted-foreground h-4 w-4" />
                  Account Details
                </span>
                <Button asChild size="sm" variant="outline">
                  <Link href="/finance/new-entry">
                    <Plus className="mr-1 h-3 w-3" />
                    New Entry
                  </Link>
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {report.accounts.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-border border-b">
                        <th className="pb-2 text-left font-medium text-muted-foreground">
                          Account
                        </th>
                        <th className="pb-2 text-right font-medium text-foreground">Budget</th>
                        <th className="pb-2 text-right font-medium text-foreground">Actual</th>
                        <th className="pb-2 text-right font-medium text-foreground">Variance</th>
                        <th className="pb-2 text-right font-medium text-foreground">%</th>
                        <th className="pb-2 text-center font-medium text-foreground">Status</th>
                        <th className="pb-2 text-left font-medium text-muted-foreground">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.accounts.map((account) => (
                        <BudgetRow key={account.accountCode} account={account} />
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-border border-t-2 font-bold">
                        <td className="py-2.5 text-foreground">Total</td>
                        <td className="py-2.5 text-right tabular-nums">
                          {formatMMK(report.totalBudget)}
                        </td>
                        <td className="py-2.5 text-right tabular-nums">
                          {formatMMK(report.totalActual)}
                        </td>
                        <td
                          className={`py-2.5 text-right tabular-nums ${
                            report.totalVariance > 0 ? "text-rose-600" : "text-emerald-600"
                          }`}
                        >
                          {report.totalVariance > 0 ? "+" : ""}
                          {formatMMK(report.totalVariance)}
                        </td>
                        <td colSpan={3} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  No budget data found. Create budgets to track spending against targets.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function BudgetRow({ account }: { account: BudgetWithVariance }): React.JSX.Element {
  const statusConfig = {
    under_budget: {
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      icon: CheckCircle2,
      label: "On Track",
    },
    near_limit: {
      color: "text-amber-600",
      bg: "bg-amber-50",
      icon: AlertTriangle,
      label: "Near Limit",
    },
    over_budget: {
      color: "text-rose-600",
      bg: "bg-rose-50",
      icon: TrendingUp,
      label: "Over Budget",
    },
    no_budget: {
      color: "text-muted-foreground",
      bg: "bg-muted/30",
      icon: AlertTriangle,
      label: "No Budget",
    },
  };

  const config = statusConfig[account.status];
  const StatusIcon = config.icon;

  return (
    <tr className="border-border border-b last:border-0">
      <td className="py-2.5 font-medium text-foreground">{account.accountLabel}</td>
      <td className="py-2.5 text-right tabular-nums">
        {account.budgetAmount > 0 ? formatMMK(account.budgetAmount) : "-"}
      </td>
      <td className="py-2.5 text-right tabular-nums">{formatMMK(account.actualAmount)}</td>
      <td
        className={`py-2.5 text-right font-medium tabular-nums ${
          account.variance > 0 ? "text-rose-600" : "text-emerald-600"
        }`}
      >
        {account.budgetAmount > 0 ? (
          <>
            {account.variance > 0 ? "+" : ""}
            {formatMMK(account.variance)}
          </>
        ) : (
          formatMMK(account.actualAmount)
        )}
      </td>
      <td className="py-2.5 text-right tabular-nums">
        {account.budgetAmount > 0 ? (
          <span className={config.color}>{account.variancePercent}%</span>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </td>
      <td className="py-2.5 text-center">
        <Badge variant="outline" className={`${config.color} ${config.bg} text-[10px] border-0`}>
          <StatusIcon className="mr-1 h-3 w-3" />
          {config.label}
        </Badge>
      </td>
      <td className="py-2.5 text-muted-foreground text-xs max-w-[120px] truncate">
        {account.notes ?? "-"}
      </td>
    </tr>
  );
}
