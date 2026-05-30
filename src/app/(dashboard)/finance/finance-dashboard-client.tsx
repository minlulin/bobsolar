"use client";

import { format } from "date-fns";
import {
  AlertTriangle,
  ArrowRightLeft,
  BarChart3,
  CheckCircle2,
  DollarSign,
  Landmark,
  PieChart,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Wallet,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import type {
  DataConsistencyCheck,
  ExpenseBreakdownRow,
  FinancePeriodFilter,
  FinanceSummaryCard,
  MonthlyTrendRow,
  ReceivableRiskInvoice,
} from "@/actions/finance-dashboard-actions";
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
import {
  useDataConsistencyCheck,
  useExpenseBreakdown,
  useFinanceDashboardData,
  useMonthlyTrendData,
  useReceivableRiskData,
} from "@/hooks/use-finance-dashboard";
import {
  CASH_ACCOUNT_GROUPS,
  LEDGER_ACCOUNT_LABELS,
  type LedgerAccountCode,
} from "@/lib/domain/finance";
import { formatMMK } from "@/lib/utils";

interface FinanceDashboardClientProps {
  initialSummary: FinanceSummaryCard | null;
  initialTrend: MonthlyTrendRow[];
  initialBreakdown: ExpenseBreakdownRow[];
  initialRisk: ReceivableRiskInvoice[];
  initialConsistency: DataConsistencyCheck | null;
}

const EXPENSE_COLORS: Record<string, string> = {
  material_expense: "#0F172A",
  labor_expense: "#D97706",
  transport_expense: "#64748B",
  general_expense: "#7C3AED",
  misc_expense: "#94A3B8",
};

export function FinanceDashboardClient({
  initialSummary,
  initialTrend,
  initialBreakdown,
  initialRisk,
  initialConsistency,
}: FinanceDashboardClientProps): React.JSX.Element {
  const [periodFilter, setPeriodFilter] = useState<FinancePeriodFilter>({});

  const { data: summaryData, isLoading: isLoadingSummary } = useFinanceDashboardData(
    initialSummary ? { ...periodFilter } : periodFilter,
  );
  const { data: trendData, isLoading: isLoadingTrend } = useMonthlyTrendData(
    initialTrend.length ? { ...periodFilter } : periodFilter,
  );
  const { data: breakdownData, isLoading: isLoadingBreakdown } = useExpenseBreakdown(
    initialBreakdown.length ? { ...periodFilter } : periodFilter,
  );
  const { data: riskData, isLoading: isLoadingRisk } = useReceivableRiskData();
  const { data: consistencyData, isLoading: isLoadingConsistency } = useDataConsistencyCheck();

  const summary = summaryData ?? initialSummary;
  const trend = trendData ?? initialTrend;
  const breakdown = breakdownData ?? initialBreakdown;
  const risk = riskData ?? initialRisk;
  const consistency = consistencyData ?? initialConsistency;

  const handlePeriodChange = useCallback((value: string) => {
    const now = new Date();
    let dateFrom: Date;

    switch (value) {
      case "30d":
        dateFrom = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        break;
      case "90d":
        dateFrom = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        break;
      case "1y":
        dateFrom = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        break;
      case "all":
        dateFrom = new Date(2020, 0, 1);
        break;
      default:
        dateFrom = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        break;
    }

    setPeriodFilter({
      dateFrom: format(dateFrom, "yyyy-MM-dd"),
      dateTo: format(now, "yyyy-MM-dd"),
    });
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Finance Dashboard
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Financial overview and performance metrics for decision making.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/finance/transfers">
              <ArrowRightLeft className="mr-2 h-4 w-4" />
              Transfer Cash
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/finance/reports">Open Reports</Link>
          </Button>
          <Select defaultValue="1y" onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last 12 months</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards - Bento Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Total Income */}
        <SummaryCard
          title="Total Income"
          value={summary?.totalIncome ?? 0}
          icon={TrendingUp}
          color="text-emerald-600"
          bgColor="bg-emerald-50"
          isLoading={isLoadingSummary}
        />

        {/* Cost of Goods Sold */}
        <SummaryCard
          title="Cost of Goods Sold"
          value={summary?.totalCogs ?? 0}
          icon={TrendingDown}
          color="text-orange-600"
          bgColor="bg-orange-50"
          isLoading={isLoadingSummary}
        />

        {/* Gross Profit */}
        <SummaryCard
          title="Gross Profit"
          value={summary?.grossProfit ?? 0}
          icon={DollarSign}
          color={(summary?.grossProfit ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600"}
          bgColor={(summary?.grossProfit ?? 0) >= 0 ? "bg-emerald-50" : "bg-rose-50"}
          isLoading={isLoadingSummary}
          showSign
        />

        {/* Operating Expenses */}
        <SummaryCard
          title="Operating Expenses"
          value={summary?.totalExpense ?? 0}
          icon={TrendingDown}
          color="text-rose-600"
          bgColor="bg-rose-50"
          isLoading={isLoadingSummary}
        />

        {/* Net Profit/Loss */}
        <SummaryCard
          title="Net Profit"
          value={summary?.netProfit ?? 0}
          icon={DollarSign}
          color={(summary?.netProfit ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600"}
          bgColor={(summary?.netProfit ?? 0) >= 0 ? "bg-emerald-50" : "bg-rose-50"}
          isLoading={isLoadingSummary}
          showSign
        />

        {/* Accounts Receivable */}
        <SummaryCard
          title="Accounts Receivable"
          value={summary?.accountsReceivable ?? 0}
          icon={AlertTriangle}
          color="text-amber-600"
          bgColor="bg-amber-50"
          isLoading={isLoadingSummary}
          absoluteValue
        />
      </div>

      {/* Liquid Assets Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <AssetCard
          label="Cash on Hand"
          value={summary?.cashBalance ?? 0}
          icon={Wallet}
          isLoading={isLoadingSummary}
          accounts={summary?.cashAccounts?.filter((a) =>
            (CASH_ACCOUNT_GROUPS.cash as readonly string[]).includes(a.code),
          )}
        />
        <AssetCard
          label="Digital Wallets"
          value={summary?.walletBalance ?? 0}
          icon={Wallet}
          isLoading={isLoadingSummary}
          accounts={summary?.cashAccounts?.filter((a) =>
            (CASH_ACCOUNT_GROUPS.wallet as readonly string[]).includes(a.code),
          )}
        />
        <AssetCard
          label="Bank Accounts"
          value={summary?.bankBalance ?? 0}
          icon={Landmark}
          isLoading={isLoadingSummary}
          accounts={summary?.cashAccounts?.filter((a) =>
            (CASH_ACCOUNT_GROUPS.banking as readonly string[]).includes(a.code),
          )}
        />
      </div>

      {/* Financial KPIs Row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          label="Gross Margin"
          value={`${summary?.grossProfitMargin ?? 0}%`}
          isLoading={isLoadingSummary}
          color={(summary?.grossProfitMargin ?? 0) >= 20 ? "text-emerald-600" : "text-amber-600"}
        />
        <KpiCard
          label="Net Margin"
          value={`${summary?.netProfitMargin ?? 0}%`}
          isLoading={isLoadingSummary}
          color={(summary?.netProfitMargin ?? 0) >= 10 ? "text-emerald-600" : "text-amber-600"}
        />
        <KpiCard
          label="Debtor Days"
          value={`${summary?.averageDebtorDays ?? 0}d`}
          isLoading={isLoadingSummary}
          color={(summary?.averageDebtorDays ?? 0) <= 30 ? "text-emerald-600" : "text-rose-600"}
        />
        <KpiCard
          label="Current Ratio"
          value={`${summary?.currentRatio ?? 0}`}
          isLoading={isLoadingSummary}
          color={(summary?.currentRatio ?? 0) >= 1.5 ? "text-emerald-600" : "text-amber-600"}
        />
        <KpiCard
          label="Working Capital"
          value={formatMMK(summary?.workingCapital ?? 0)}
          isLoading={isLoadingSummary}
          color={(summary?.workingCapital ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600"}
        />
        <KpiCard
          label="Net Cash"
          value={formatMMK(summary?.netCashPosition ?? 0)}
          isLoading={isLoadingSummary}
          color="text-foreground"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
        {/* Monthly Trend Chart */}
        <Card className="border-border lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <BarChart3 className="text-muted-foreground h-4 w-4" />
                Income vs Expense Trend
              </CardTitle>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Income
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose-500" />
                  Expense
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingTrend ? (
              <Skeleton className="h-48 w-full" />
            ) : trend.length > 0 ? (
              <TrendChart data={trend} />
            ) : (
              <EmptyChart message="No trend data available for selected period." />
            )}
          </CardContent>
        </Card>

        {/* Expense Breakdown */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <PieChart className="text-muted-foreground h-4 w-4" />
              Expense Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingBreakdown ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map(() => (
                  <Skeleton key={crypto.randomUUID()} className="h-6 w-full" />
                ))}
              </div>
            ) : breakdown.length > 0 ? (
              <ExpenseBreakdownChart data={breakdown} />
            ) : (
              <EmptyChart message="No expense data available." />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Receivable Risk & Data Consistency */}
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        {/* Receivable Risk */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <AlertTriangle className="text-amber-500 h-4 w-4" />
              Receivable Risk
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingRisk ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map(() => (
                  <Skeleton key={crypto.randomUUID()} className="h-12 w-full" />
                ))}
              </div>
            ) : risk.length > 0 ? (
              <div className="space-y-3">
                {risk.slice(0, 5).map((invoice) => (
                  <RiskProjectRow key={invoice.invoiceId} invoice={invoice} />
                ))}
                {risk.length > 5 && (
                  <p className="text-muted-foreground text-center text-xs">
                    +{risk.length - 5} more outstanding projects
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle2 className="text-emerald-500 mb-2 h-8 w-8" />
                <p className="text-foreground text-sm font-medium">All clear</p>
                <p className="text-muted-foreground text-xs">No outstanding receivables</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Data Consistency */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <ShieldCheck className="text-muted-foreground h-4 w-4" />
              Data Consistency Check
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingConsistency ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : consistency ? (
              <div className="space-y-4">
                <ConsistencyRow
                  label="AR Collections"
                  journalValue={consistency.journalIncome}
                  operationalValue={consistency.operationalPayments}
                  isMatch={consistency.incomeMatch}
                />
                <ConsistencyRow
                  label="Expenses"
                  journalValue={consistency.journalExpense}
                  operationalValue={consistency.operationalCosts}
                  isMatch={consistency.expenseMatch}
                />

                {consistency.discrepancies.length > 0 ? (
                  <div className="border-border border-t pt-4">
                    <div className="flex items-center gap-2 text-rose-600">
                      <XCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        {consistency.discrepancies.length} discrepancy detected
                      </span>
                    </div>
                    <ul className="text-muted-foreground mt-2 space-y-1 text-xs">
                      {consistency.discrepancies.map((d) => (
                        <li key={d}>{d}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="border-border border-t pt-4">
                    <div className="flex items-center gap-2 text-emerald-600">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="text-sm font-medium">All data consistent</span>
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Journal totals match operational records.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <EmptyChart message="Unable to load consistency data." />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface SummaryCardProps {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  isLoading: boolean;
  showSign?: boolean;
  absoluteValue?: boolean;
}

function SummaryCard({
  title,
  value,
  icon: Icon,
  color,
  bgColor,
  isLoading,
  showSign,
  absoluteValue,
}: SummaryCardProps): React.JSX.Element {
  const displayValue = absoluteValue ? Math.abs(value) : value;

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
                {title}
              </p>
              <p className={`text-xl font-bold tabular-nums ${color}`}>
                {showSign && value >= 0 ? "+" : showSign && value < 0 ? "-" : ""}
                {formatMMK(displayValue)}
              </p>
            </div>
            <div className={`rounded-lg p-2 ${bgColor}`}>
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface AssetCardProps {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  isLoading: boolean;
  accounts?: { code: string; balance: number }[] | undefined;
}

function AssetCard({
  label,
  value,
  icon: Icon,
  isLoading,
  accounts,
}: AssetCardProps): React.JSX.Element {
  return (
    <Card className="border-border transition-shadow hover:shadow-sm">
      <CardContent className="p-4">
        {isLoading ? (
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <div className="space-y-1.5 w-full">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-24" />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-slate-100 p-2">
                <Icon className="text-muted-foreground h-4 w-4" />
              </div>
              <div>
                <p className="text-muted-foreground text-xs">{label}</p>
                <p className="text-foreground text-base font-semibold tabular-nums">
                  {formatMMK(value)}
                </p>
              </div>
            </div>

            {accounts && accounts.length > 0 && (
              <div className="pt-2 border-t space-y-1.5">
                {accounts.map((acc) => (
                  <div key={acc.code} className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">
                      {LEDGER_ACCOUNT_LABELS[acc.code as LedgerAccountCode] ?? acc.code}
                    </span>
                    <span className="font-medium tabular-nums">{formatMMK(acc.balance)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface KpiCardProps {
  label: string;
  value: string;
  isLoading: boolean;
  color: string;
}

function KpiCard({ label, value, isLoading, color }: KpiCardProps): React.JSX.Element {
  return (
    <Card className="border-border transition-shadow hover:shadow-sm">
      <CardContent className="p-4">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-20" />
          </div>
        ) : (
          <div>
            <p className="text-muted-foreground text-xs">{label}</p>
            <p className={`text-base font-bold tabular-nums ${color}`}>{value}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface TrendChartProps {
  data: MonthlyTrendRow[];
}

function TrendChart({ data }: TrendChartProps): React.JSX.Element {
  const maxVal = Math.max(...data.map((d) => Math.max(d.income, d.expense)), 1);
  const height = 192;
  const width = 100;
  const padding = 5;

  const incomePoints = data
    .map((d, i) => {
      const x = padding + (i / Math.max(data.length - 1, 1)) * (width - padding * 2);
      const y = height - padding - (d.income / maxVal) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const expensePoints = data
    .map((d, i) => {
      const x = padding + (i / Math.max(data.length - 1, 1)) * (width - padding * 2);
      const y = height - padding - (d.expense / maxVal) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-48 w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label="Income vs Expense Trend Chart"
      >
        <title>Income vs Expense Trend</title>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
          <line
            key={pct}
            x1={padding}
            y1={height - padding - pct * (height - padding * 2)}
            x2={width - padding}
            y2={height - padding - pct * (height - padding * 2)}
            stroke="currentColor"
            className="text-border"
            strokeWidth="0.3"
          />
        ))}

        {/* Income line */}
        <polyline
          points={incomePoints}
          fill="none"
          stroke="#10B981"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Expense line */}
        <polyline
          points={expensePoints}
          fill="none"
          stroke="#F43F5E"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {data.map((d) => {
          const i = data.indexOf(d);
          const x = padding + (i / Math.max(data.length - 1, 1)) * (width - padding * 2);
          const incomeY = height - padding - (d.income / maxVal) * (height - padding * 2);
          const expenseY = height - padding - (d.expense / maxVal) * (height - padding * 2);
          return (
            <g key={d.month}>
              <circle cx={x} cy={incomeY} r="1.5" fill="#10B981" />
              <circle cx={x} cy={expenseY} r="1.5" fill="#F43F5E" />
            </g>
          );
        })}
      </svg>

      {/* X-axis labels */}
      <div className="mt-1 flex justify-between px-1">
        {data
          .filter((_, i) => i % Math.max(Math.floor(data.length / 6), 1) === 0)
          .map((d) => (
            <span key={d.month} className="text-muted-foreground text-[10px]">
              {format(new Date(`${d.month}-01`), "MMM")}
            </span>
          ))}
      </div>
    </div>
  );
}

interface ExpenseBreakdownChartProps {
  data: ExpenseBreakdownRow[];
}

function ExpenseBreakdownChart({ data }: ExpenseBreakdownChartProps): React.JSX.Element {
  return (
    <div className="space-y-3">
      {data.map((item) => (
        <div key={item.type} className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-foreground font-medium">{item.label}</span>
            <span className="text-muted-foreground tabular-nums">
              {formatMMK(item.amount)} ({item.percentage}%)
            </span>
          </div>
          <div className="bg-muted h-2 overflow-hidden rounded-full">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${item.percentage}%`,
                backgroundColor: EXPENSE_COLORS[item.type] ?? "#94A3B8",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

interface RiskProjectRowProps {
  invoice: ReceivableRiskInvoice;
}

function RiskProjectRow({ invoice }: RiskProjectRowProps): React.JSX.Element {
  const isOverdue = invoice.daysOverdue > 0;

  return (
    <div className="border-border flex items-center justify-between rounded-lg border p-3">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-foreground text-sm font-medium">{invoice.invoiceNumber}</span>
          {isOverdue && (
            <Badge variant="outline" className="text-xs border-rose-200 bg-rose-50 text-rose-700">
              {invoice.daysOverdue}d overdue
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground text-xs">{invoice.customerName}</p>
      </div>
      <div className="text-right">
        <p className="text-rose-600 text-sm font-semibold tabular-nums">
          {formatMMK(invoice.outstanding)}
        </p>
        <p className="text-muted-foreground text-xs">outstanding</p>
      </div>
    </div>
  );
}

interface ConsistencyRowProps {
  label: string;
  journalValue: number;
  operationalValue: number;
  isMatch: boolean;
}

function ConsistencyRow({
  label,
  journalValue,
  operationalValue,
  isMatch,
}: ConsistencyRowProps): React.JSX.Element {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {isMatch ? (
          <CheckCircle2 className="text-emerald-500 h-4 w-4" />
        ) : (
          <XCircle className="text-rose-500 h-4 w-4" />
        )}
        <span className="text-foreground text-sm font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-3 text-xs tabular-nums">
        <span className="text-muted-foreground">Journal: {formatMMK(journalValue)}</span>
        <span className="text-muted-foreground">vs</span>
        <span className="text-muted-foreground">Ops: {formatMMK(operationalValue)}</span>
      </div>
    </div>
  );
}

function EmptyChart({ message }: { message: string }): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <BarChart3 className="text-muted-foreground/50 mb-2 h-8 w-8" />
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
}
