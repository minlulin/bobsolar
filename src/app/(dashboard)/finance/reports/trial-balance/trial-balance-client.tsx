"use client";

import { useQuery } from "@tanstack/react-query";
import { endOfMonth, format, subMonths } from "date-fns";
import { AlertCircle, ArrowLeft, BookCheck, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { getTrialBalance, type TrialBalanceData } from "@/actions/trial-balance-actions";
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
import { reportKeys } from "@/lib/query-keys";
import { formatMMK } from "@/lib/utils";

interface TrialBalanceClientProps {
  initialData: TrialBalanceData | null;
}

export function TrialBalanceClient({ initialData }: TrialBalanceClientProps): React.JSX.Element {
  const [dateAsOf, setDateAsOf] = useState<string>(
    initialData?.dateAsOf
      ? format(new Date(initialData.dateAsOf), "yyyy-MM-dd")
      : format(new Date(), "yyyy-MM-dd"),
  );

  const { data, isLoading } = useQuery({
    queryKey: reportKeys.trialBalance(dateAsOf),
    queryFn: async () => {
      const result = await getTrialBalance({ dateAsOf: dateAsOf || undefined });
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
            Trial Balance
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Verify that total debits equal total credits across all ledger accounts.
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
        </div>
      ) : !data ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <AlertCircle className="text-muted-foreground/50 mb-2 h-8 w-8" />
          <p className="text-muted-foreground text-sm">Unable to load trial balance data.</p>
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
              ? `Trial Balance is balanced — Total Debits = Total Credits = ${formatMMK(data.totalDebit)}`
              : `Trial Balance is OUT OF BALANCE — Debits ${formatMMK(data.totalDebit)} ≠ Credits ${formatMMK(data.totalCredit)}`}
          </div>

          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <BookCheck className="text-muted-foreground h-4 w-4" />
                Account Balances
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-border border-b">
                      <th className="text-muted-foreground pb-2 pr-4 text-left font-medium">
                        Code
                      </th>
                      <th className="text-muted-foreground pb-2 pr-4 text-left font-medium">
                        Account
                      </th>
                      <th className="text-muted-foreground pb-2 pr-4 text-left font-medium">
                        Type
                      </th>
                      <th className="text-muted-foreground pb-2 pr-4 text-right font-medium">
                        Debit
                      </th>
                      <th className="text-muted-foreground pb-2 pr-4 text-right font-medium">
                        Credit
                      </th>
                      <th className="text-muted-foreground pb-2 text-right font-medium">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.accounts.map((account) => (
                      <tr key={account.code} className="border-border border-b">
                        <td className="text-muted-foreground py-2 pr-4 font-mono text-xs">
                          {account.code}
                        </td>
                        <td className="text-foreground py-2 pr-4">{account.label}</td>
                        <td className="text-muted-foreground py-2 pr-4 capitalize">
                          {account.type}
                        </td>
                        <td className="text-foreground py-2 pr-4 text-right tabular-nums">
                          {account.debit > 0 ? formatMMK(account.debit) : "—"}
                        </td>
                        <td className="text-foreground py-2 pr-4 text-right tabular-nums">
                          {account.credit > 0 ? formatMMK(account.credit) : "—"}
                        </td>
                        <td
                          className={`py-2 text-right font-medium tabular-nums ${
                            account.balance >= 0 ? "text-foreground" : "text-rose-600"
                          }`}
                        >
                          {formatMMK(account.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-border border-t-2 font-bold">
                      <td colSpan={3} className="text-foreground py-2 pr-4">
                        Total
                      </td>
                      <td className="text-foreground py-2 pr-4 text-right tabular-nums">
                        {formatMMK(data.totalDebit)}
                      </td>
                      <td className="text-foreground py-2 pr-4 text-right tabular-nums">
                        {formatMMK(data.totalCredit)}
                      </td>
                      <td
                        className={`py-2 text-right tabular-nums ${
                          data.isBalanced ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {formatMMK(data.totalDebit - data.totalCredit)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
