"use server";

import { parseISO } from "date-fns";
import { and, eq, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { requireFinanceAccess } from "@/lib/auth/validate";
import { db } from "@/lib/db";
import { journalEntries, journalLines, ledgerAccounts } from "@/lib/db/schema";
import {
  CURRENT_ASSET_ACCOUNT_CODES,
  CURRENT_LIABILITY_ACCOUNT_CODES,
  LEDGER_ACCOUNT_CODE_TYPE_MAP,
  LEDGER_ACCOUNT_LABELS,
  type LedgerAccountCode,
} from "@/lib/domain/finance";
import { type ActionResponse, successResponse } from "@/lib/utils/action-response";
import { handleActionError } from "@/lib/utils/error";

const balanceSheetFilterSchema = z.object({
  dateAsOf: z.string().optional(),
});

export interface BalanceSheetAccount {
  code: LedgerAccountCode;
  label: string;
  balance: number;
}

export interface BalanceSheetSection {
  accounts: BalanceSheetAccount[];
  total: number;
}

export interface BalanceSheetData {
  assets: {
    currentAssets: BalanceSheetSection;
    totalAssets: number;
  };
  liabilities: {
    currentLiabilities: BalanceSheetSection;
    totalLiabilities: number;
  };
  equity: {
    accounts: BalanceSheetSection;
    retainedEarnings: number;
    totalEquity: number;
  };
  totalLiabilitiesAndEquity: number;
  isBalanced: boolean;
  dateAsOf: string;
}

export async function getBalanceSheet(
  rawFilters: unknown = {},
): Promise<ActionResponse<BalanceSheetData>> {
  try {
    await requireFinanceAccess();

    const filters = balanceSheetFilterSchema.parse(rawFilters);
    const dateAsOf = filters.dateAsOf ? parseISO(filters.dateAsOf) : new Date();

    // Fetch all account balances as of the given date
    const accountBalances = await db
      .select({
        code: ledgerAccounts.code,
        balance:
          sql<number>`coalesce(sum(${journalLines.debit}::numeric) - sum(${journalLines.credit}::numeric), 0)`.as(
            "balance",
          ),
      })
      .from(journalLines)
      .innerJoin(ledgerAccounts, eq(journalLines.accountId, ledgerAccounts.id))
      .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .where(and(lte(journalEntries.entryDate, dateAsOf), eq(journalEntries.isReversed, false)))
      .groupBy(ledgerAccounts.code);

    // Build balance map
    const balanceMap = new Map<string, number>();
    for (const row of accountBalances) {
      balanceMap.set(row.code, Math.round(row.balance));
    }

    // Compute retained earnings (net income = income - expenses - COGS)
    const incomeCodes = Object.entries(LEDGER_ACCOUNT_CODE_TYPE_MAP)
      .filter(([, type]) => type === "income")
      .map(([code]) => code);
    const expenseCodes = Object.entries(LEDGER_ACCOUNT_CODE_TYPE_MAP)
      .filter(([, type]) => type === "expense")
      .map(([code]) => code);

    let totalIncome = 0;
    for (const code of incomeCodes) {
      // Income accounts have credit balance (negative in our debit-credit model)
      totalIncome += Math.abs(balanceMap.get(code) ?? 0);
    }

    let totalExpenses = 0;
    for (const code of expenseCodes) {
      totalExpenses += balanceMap.get(code) ?? 0;
    }

    const retainedEarnings = totalIncome - totalExpenses;

    // Classify assets
    const currentAssetCodes: readonly LedgerAccountCode[] = CURRENT_ASSET_ACCOUNT_CODES;

    const currentAssets: BalanceSheetAccount[] = [];
    let totalCurrentAssets = 0;
    for (const code of currentAssetCodes) {
      const balance = balanceMap.get(code) ?? 0;
      if (balance !== 0) {
        currentAssets.push({
          code,
          label: LEDGER_ACCOUNT_LABELS[code],
          balance,
        });
        totalCurrentAssets += balance;
      }
    }

    // Classify liabilities
    const currentLiabilityCodes: readonly LedgerAccountCode[] = CURRENT_LIABILITY_ACCOUNT_CODES;

    const currentLiabilities: BalanceSheetAccount[] = [];
    let totalCurrentLiabilities = 0;
    for (const code of currentLiabilityCodes) {
      // Liability accounts have credit balance (negative in our model)
      const balance = Math.abs(balanceMap.get(code) ?? 0);
      if (balance !== 0) {
        currentLiabilities.push({
          code,
          label: LEDGER_ACCOUNT_LABELS[code],
          balance,
        });
        totalCurrentLiabilities += balance;
      }
    }

    // Equity
    const ownerEquityBalance = Math.abs(balanceMap.get("owner_equity") ?? 0);
    const equityAccountList: BalanceSheetAccount[] = [];
    if (ownerEquityBalance !== 0) {
      equityAccountList.push({
        code: "owner_equity",
        label: LEDGER_ACCOUNT_LABELS.owner_equity,
        balance: ownerEquityBalance,
      });
    }
    if (retainedEarnings !== 0) {
      equityAccountList.push({
        code: "retained_earnings",
        label: LEDGER_ACCOUNT_LABELS.retained_earnings,
        balance: retainedEarnings,
      });
    }

    const totalEquity = ownerEquityBalance + retainedEarnings;
    const totalLiabilitiesAndEquity = totalCurrentLiabilities + totalEquity;

    return successResponse({
      assets: {
        currentAssets: { accounts: currentAssets, total: totalCurrentAssets },
        totalAssets: totalCurrentAssets,
      },
      liabilities: {
        currentLiabilities: { accounts: currentLiabilities, total: totalCurrentLiabilities },
        totalLiabilities: totalCurrentLiabilities,
      },
      equity: {
        accounts: { accounts: equityAccountList, total: totalEquity },
        retainedEarnings,
        totalEquity,
      },
      totalLiabilitiesAndEquity,
      isBalanced: totalCurrentAssets === totalLiabilitiesAndEquity,
      dateAsOf: dateAsOf.toISOString(),
    });
  } catch (error) {
    return handleActionError(error, "getBalanceSheet", "Failed to fetch balance sheet");
  }
}
