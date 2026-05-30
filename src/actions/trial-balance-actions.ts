"use server";

import { parseISO } from "date-fns";
import { and, eq, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { requireFinanceAccess } from "@/lib/auth/validate";
import { db } from "@/lib/db";
import { journalEntries, journalLines, ledgerAccounts } from "@/lib/db/schema";
import { LEDGER_ACCOUNT_LABELS, type LedgerAccountCode } from "@/lib/domain/finance";
import { type ActionResponse, successResponse } from "@/lib/utils/action-response";
import { handleActionError } from "@/lib/utils/error";

const trialBalanceFilterSchema = z.object({
  dateAsOf: z.string().optional(),
});

export interface TrialBalanceAccount {
  code: LedgerAccountCode;
  label: string;
  type: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface TrialBalanceData {
  accounts: TrialBalanceAccount[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  dateAsOf: string;
}

export async function getTrialBalance(
  rawFilters: unknown = {},
): Promise<ActionResponse<TrialBalanceData>> {
  try {
    await requireFinanceAccess();

    const filters = trialBalanceFilterSchema.parse(rawFilters);
    const dateAsOf = filters.dateAsOf ? parseISO(filters.dateAsOf) : new Date();

    // Fetch all account balances as of the given date
    const accountRows = await db
      .select({
        code: ledgerAccounts.code,
        type: ledgerAccounts.type,
        totalDebit: sql<number>`coalesce(sum(${journalLines.debit}::numeric), 0)`.as("total_debit"),
        totalCredit: sql<number>`coalesce(sum(${journalLines.credit}::numeric), 0)`.as(
          "total_credit",
        ),
      })
      .from(journalLines)
      .innerJoin(ledgerAccounts, eq(journalLines.accountId, ledgerAccounts.id))
      .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .where(and(lte(journalEntries.entryDate, dateAsOf), eq(journalEntries.isReversed, false)))
      .groupBy(ledgerAccounts.code, ledgerAccounts.type)
      .orderBy(ledgerAccounts.code);

    const accounts: TrialBalanceAccount[] = [];
    let totalDebit = 0;
    let totalCredit = 0;

    for (const row of accountRows) {
      const debit = Math.round(row.totalDebit);
      const credit = Math.round(row.totalCredit);
      const balance = debit - credit;

      // Only show accounts with activity
      if (debit === 0 && credit === 0) continue;

      accounts.push({
        code: row.code as LedgerAccountCode,
        label: LEDGER_ACCOUNT_LABELS[row.code as LedgerAccountCode] ?? row.code,
        type: row.type,
        debit,
        credit,
        balance,
      });

      totalDebit += debit;
      totalCredit += credit;
    }

    return successResponse({
      accounts,
      totalDebit,
      totalCredit,
      isBalanced: totalDebit === totalCredit,
      dateAsOf: dateAsOf.toISOString(),
    });
  } catch (error) {
    return handleActionError(error, "getTrialBalance", "Failed to fetch trial balance");
  }
}
