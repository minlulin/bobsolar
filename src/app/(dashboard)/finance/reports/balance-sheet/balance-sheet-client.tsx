"use client";

import { useQuery } from "@tanstack/react-query";
import { endOfMonth, format, subMonths } from "date-fns";
import { AlertCircle, ArrowLeft, Scale, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { type BalanceSheetData, getBalanceSheet } from "@/actions/balance-sheet-actions";
import { BackButton } from "@/components/shared/back-button";
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
import { formatMMK } from "@/lib/utils";

interface BalanceSheetClientProps {
  initialData: BalanceSheetData | null;
}

export function BalanceSheetClient({ initialData }: BalanceSheetClientProps): React.JSX.Element {
  const [dateAsOf, setDateAsOf] = useState<string>(
    initialData?.dateAsOf
      ? format(new Date(initialData.dateAsOf), "yyyy-MM-dd")
      : format(new Date(), "yyyy-MM-dd"),
  );

  const { data, isLoading } = useQuery({
    queryKey: ["balance-sheet", dateAsOf],
    queryFn: async () => {
      const result = await getBalanceSheet({ dateAsOf: dateAsOf || undefined });
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    initialData: initialData ?? undefined,
    staleTime: 30 * 1000,
  });

  const handleDateChange = useCallback((value: string) => {
    if (!value || value === "today") {
      setDateAsOf(format(new Date(), "yyyy-MM-dd"));
    } else if (value === "end_of_month") {
      setDateAsOf(format(endOfMonth(new Date()), "yyyy-MM-dd"));
    } else if (value === "end_of_last_month") {
      setDateAsOf(format(endOfMonth(subMonths(new Date(), 1)), "yyyy-MM-dd"));
    } else {
      setDateAsOf(value);
    }
  }, []);

  return (
    <div className="space-y-6">
      <BackButton />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Balance Sheet
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Assets, liabilities, and equity at a specific point in time.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/finance/reports">
              <ArrowLeft className="mr-2 h-4 w-4" />
              All Reports
            </Link>
          </Button>
          <Select defaultValue="today" onValueChange={handleDateChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="As of Today" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">As of Today</SelectItem>
              <SelectItem value="end_of_month">End of Current Month</SelectItem>
              <SelectItem value="end_of_last_month">End of Last Month</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading && !data ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : !data ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <AlertCircle className="text-muted-foreground/50 mb-2 h-8 w-8" />
          <p className="text-muted-foreground text-sm">Unable to load balance sheet data.</p>
        </div>
      ) : (
        <>
          {/* Balance indicator */}
          <div
            className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${
              data.isBalanced
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            {data.isBalanced ? (
              <ShieldCheck className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            {data.isBalanced
              ? "Balance Sheet is balanced (Assets = Liabilities + Equity)"
              : "Balance Sheet is OUT OF BALANCE — investigate immediately"}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Assets */}
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Scale className="text-muted-foreground h-4 w-4" />
                  Assets
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <SectionTable
                  title="Current Assets"
                  accounts={data.assets.currentAssets.accounts}
                  total={data.assets.currentAssets.total}
                />
                <div className="border-border border-t pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-foreground text-sm font-bold">Total Assets</span>
                    <span className="text-foreground text-sm font-bold tabular-nums">
                      {formatMMK(data.assets.totalAssets)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Liabilities & Equity */}
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Scale className="text-muted-foreground h-4 w-4" />
                  Liabilities & Equity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <SectionTable
                  title="Current Liabilities"
                  accounts={data.liabilities.currentLiabilities.accounts}
                  total={data.liabilities.currentLiabilities.total}
                />

                <div className="space-y-2">
                  <h4 className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    Equity
                  </h4>
                  {data.equity.accounts.accounts.length > 0 ? (
                    <div className="space-y-1">
                      {data.equity.accounts.accounts.map((account) => (
                        <div
                          key={account.code}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="text-foreground">{account.label}</span>
                          <span className="text-foreground tabular-nums">
                            {formatMMK(account.balance)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-xs">No equity entries</p>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground font-medium">Total Equity</span>
                    <span className="text-foreground font-medium tabular-nums">
                      {formatMMK(data.equity.totalEquity)}
                    </span>
                  </div>
                </div>

                <div className="border-border border-t pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-foreground text-sm font-bold">
                      Total Liabilities & Equity
                    </span>
                    <span className="text-foreground text-sm font-bold tabular-nums">
                      {formatMMK(data.totalLiabilitiesAndEquity)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function SectionTable({
  title,
  accounts,
  total,
}: {
  title: string;
  accounts: { code: string; label: string; balance: number }[];
  total: number;
}): React.JSX.Element {
  return (
    <div className="space-y-2">
      <h4 className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{title}</h4>
      {accounts.length > 0 ? (
        <div className="space-y-1">
          {accounts.map((account) => (
            <div key={account.code} className="flex items-center justify-between text-sm">
              <span className="text-foreground">{account.label}</span>
              <span className="text-foreground tabular-nums">{formatMMK(account.balance)}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">No entries</p>
      )}
      <div className="flex items-center justify-between text-sm">
        <span className="text-foreground font-medium">Total {title}</span>
        <span className="text-foreground font-medium tabular-nums">{formatMMK(total)}</span>
      </div>
    </div>
  );
}
