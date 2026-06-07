"use client";

import { format } from "date-fns";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { LedgerEntryRow } from "@/actions/ledger-actions";
import { Badge } from "@/components/ui/badge";
import { LEDGER_ACCOUNT_LABELS } from "@/lib/domain/finance";
import { formatMMK } from "@/lib/utils";

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

interface JournalEntryRowProps {
  entry: LedgerEntryRow;
  isExpanded: boolean;
  onToggle: () => void;
}

export function JournalEntryRow({
  entry,
  isExpanded,
  onToggle,
}: JournalEntryRowProps): React.JSX.Element {
  const totalDebit = entry.lines.reduce((sum, l) => sum + l.debit, 0);
  const totalCredit = entry.lines.reduce((sum, l) => sum + l.credit, 0);

  return (
    <div className={entry.isReversed ? "bg-muted/20" : ""}>
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
            <span className="text-muted-foreground line-clamp-1 text-sm">
              {entry.memo || "\u2014"}
            </span>
            {entry.creatorName && (
              <span className="text-muted-foreground/70 ml-1 text-xs">by {entry.creatorName}</span>
            )}
          </div>
          <div className="col-span-2 text-right">
            <span className="text-emerald-600 text-sm font-medium tabular-nums">
              {totalDebit > 0 ? formatMMK(totalDebit) : "\u2014"}
            </span>
          </div>
          <div className="col-span-2 text-right">
            <span className="text-rose-600 text-sm font-medium tabular-nums">
              {totalCredit > 0 ? formatMMK(totalCredit) : "\u2014"}
            </span>
          </div>
        </div>
      </button>

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
                    <span className="text-muted-foreground">{"\u2014"}</span>
                  )}
                </div>
                <div className="col-span-1 text-right">
                  {line.credit > 0 ? (
                    <span className="text-rose-600 font-medium tabular-nums">
                      {formatMMK(line.credit)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{"\u2014"}</span>
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
