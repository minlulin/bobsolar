"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LEDGER_ACCOUNT_LABELS } from "@/lib/domain/finance";
import { formatMMK } from "@/lib/utils";

interface BalanceRow {
  accountCode: string;
  accountType: string;
  totalDebit: number;
  totalCredit: number;
  balance: number;
}

interface LedgerBalancesPanelProps {
  data: BalanceRow[] | undefined;
  isLoading: boolean;
}

export function LedgerBalancesPanel({
  data,
  isLoading,
}: LedgerBalancesPanelProps): React.JSX.Element {
  return (
    <Card className="border-border">
      <CardContent className="p-4">
        <h3 className="font-heading mb-3 text-sm font-semibold text-foreground">
          Account Balances
        </h3>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholder
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : data?.length ? (
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
                {data.map((row) => (
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
                      {row.totalDebit > 0 ? formatMMK(row.totalDebit) : "\u2014"}
                    </td>
                    <td className="text-rose-600 px-3 py-2 text-right tabular-nums">
                      {row.totalCredit > 0 ? formatMMK(row.totalCredit) : "\u2014"}
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
  );
}
