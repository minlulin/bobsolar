"use client";

import { CheckCircle2, ClipboardCheck, XCircle } from "lucide-react";
import { useState } from "react";
import type { MonthEndCloseReport } from "@/actions/month-end-close-actions";
import { BackButton } from "@/components/shared/back-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMMK } from "@/lib/utils";

interface MonthEndCloseClientProps {
  initialReport: MonthEndCloseReport | null;
}

export function MonthEndCloseClient({
  initialReport,
}: MonthEndCloseClientProps): React.JSX.Element {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [report, setReport] = useState<MonthEndCloseReport | null>(initialReport);
  const [isLoading, setIsLoading] = useState(false);

  const handleFetch = async () => {
    setIsLoading(true);
    try {
      const { getMonthEndCloseReport } = await import("@/actions/month-end-close-actions");
      const result = await getMonthEndCloseReport({ year: selectedYear, month: selectedMonth });
      if (result.success) {
        setReport(result.data);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  return (
    <div className="space-y-6">
      <BackButton />
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Month-End Close
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Checklist and verification for closing the accounting period.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={selectedMonth.toString()}
            onValueChange={(v) => setSelectedMonth(Number.parseInt(v, 10))}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m} value={months.indexOf(m).toString()}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={selectedYear.toString()}
            onValueChange={(v) => setSelectedYear(Number.parseInt(v, 10))}
          >
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={y.toString()}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <button
            type="button"
            onClick={handleFetch}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-md bg-(--color-deep-navy) px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-(--color-deep-navy)/90 disabled:opacity-50"
          >
            <ClipboardCheck className="h-4 w-4" />
            {isLoading ? "Loading..." : "Check"}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryMetric
          label="Total Income"
          value={report?.totalIncome ?? 0}
          color="text-emerald-600"
          isLoading={isLoading}
        />
        <SummaryMetric
          label="Total Expense"
          value={report?.totalExpense ?? 0}
          color="text-rose-600"
          isLoading={isLoading}
        />
        <SummaryMetric
          label="Net Profit"
          value={report?.netProfit ?? 0}
          color={(report?.netProfit ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600"}
          isLoading={isLoading}
          showSign
        />
      </div>

      {/* Checklist */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <ClipboardCheck className="text-muted-foreground h-4 w-4" />
            Close Checklist
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholder
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : report ? (
            <div className="space-y-4">
              {report.checks.map((check) => (
                <CheckItem key={check.id} item={check} />
              ))}

              {/* Overall Status */}
              <div
                className={`mt-4 rounded-lg border p-4 ${
                  report.allPassed
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-amber-200 bg-amber-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  {report.allPassed ? (
                    <CheckCircle2 className="text-emerald-600 h-5 w-5" />
                  ) : (
                    <XCircle className="text-amber-600 h-5 w-5" />
                  )}
                  <div>
                    <p
                      className={`text-sm font-semibold ${
                        report.allPassed ? "text-emerald-800" : "text-amber-800"
                      }`}
                    >
                      {report.allPassed
                        ? "All checks passed - ready to close"
                        : "Some checks require attention"}
                    </p>
                    <p
                      className={`text-xs ${
                        report.allPassed ? "text-emerald-700" : "text-amber-700"
                      }`}
                    >
                      {report.month} - {report.projectCount} completed projects
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground py-8 text-center text-sm">
              Select a month and click Check to run the close checklist.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface CheckItemProps {
  item: {
    id: string;
    label: string;
    description: string;
    status: "pass" | "fail" | "warning";
    detail?: string;
  };
}

function CheckItem({ item }: CheckItemProps): React.JSX.Element {
  const statusConfig = {
    pass: {
      icon: CheckCircle2,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      badge: "text-emerald-700 border-emerald-300 bg-emerald-50",
      badgeText: "Pass",
    },
    fail: {
      icon: XCircle,
      color: "text-rose-600",
      bg: "bg-rose-50",
      border: "border-rose-200",
      badge: "text-rose-700 border-rose-300 bg-rose-50",
      badgeText: "Fail",
    },
    warning: {
      icon: ClipboardCheck,
      color: "text-amber-600",
      bg: "bg-amber-50",
      border: "border-amber-200",
      badge: "text-amber-700 border-amber-300 bg-amber-50",
      badgeText: "Review",
    },
  };

  const config = statusConfig[item.status];
  const Icon = config.icon;

  return (
    <div className={`rounded-lg border p-4 ${config.border} ${config.bg}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <Icon className={`mt-0.5 h-5 w-5 ${config.color}`} />
          <div>
            <p className="text-sm font-semibold text-foreground">{item.label}</p>
            <p className="text-muted-foreground text-xs">{item.description}</p>
            {item.detail && (
              <p className="text-muted-foreground mt-1 font-mono text-xs">{item.detail}</p>
            )}
          </div>
        </div>
        <Badge variant="outline" className={config.badge}>
          {config.badgeText}
        </Badge>
      </div>
    </div>
  );
}

interface SummaryMetricProps {
  label: string;
  value: number;
  color: string;
  isLoading: boolean;
  showSign?: boolean;
}

function SummaryMetric({
  label,
  value,
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
          <div>
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              {label}
            </p>
            <p className={`text-xl font-bold tabular-nums ${color}`}>
              {showSign && value >= 0 ? "+" : showSign && value < 0 ? "-" : ""}
              {formatMMK(Math.abs(value))}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
