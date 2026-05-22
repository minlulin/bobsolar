"use server";

import { endOfDay, format, parseISO, startOfDay, subMonths } from "date-fns";
import { and, eq, gte, inArray, lt, lte, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { requireFinanceAccess } from "@/lib/auth/validate";
import { db } from "@/lib/db";
import {
  journalEntries,
  journalLines,
  ledgerAccounts,
  paymentMethods,
  projectCosts,
  projectPayments,
} from "@/lib/db/schema";
import { type ActionResponse, successResponse } from "@/lib/utils/action-response";
import { handleActionError } from "@/lib/utils/error";

const periodSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export type CashMovementPeriod = z.input<typeof periodSchema>;

export interface CashMovementByAccount {
  accountCode: string;
  accountName: string;
  totalIn: number;
  totalOut: number;
  netMovement: number;
  openingBalance: number;
  closingBalance: number;
}

export interface CashMovementByMethod {
  methodName: string;
  totalIn: number;
  totalOut: number;
  netMovement: number;
}

export interface CashMovementReport {
  periodStart: string;
  periodEnd: string;
  byAccount: CashMovementByAccount[];
  byMethod: CashMovementByMethod[];
  totalIn: number;
  totalOut: number;
  netMovement: number;
}

export async function getCashMovementReport(
  rawFilters: unknown = {},
): Promise<ActionResponse<CashMovementReport>> {
  try {
    await requireFinanceAccess();

    const filters = periodSchema.parse(rawFilters);
    const now = new Date();
    const dateFrom = filters.dateFrom
      ? startOfDay(parseISO(filters.dateFrom))
      : startOfDay(subMonths(now, 11));
    const dateTo = filters.dateTo ? endOfDay(parseISO(filters.dateTo)) : endOfDay(now);

    const assetAccounts = [
      "cash_on_hand",
      "kbz_wallet",
      "wave_wallet",
      "aya_wallet",
      "bank_account",
    ];

    const accountRows = await db
      .select({
        accountCode: ledgerAccounts.code,
        accountName: ledgerAccounts.name,
        totalIn:
          sql<number>`coalesce(sum(case when ${journalLines.debit} > 0 then ${journalLines.debit}::numeric else 0 end), 0)`.as(
            "total_in",
          ),
        totalOut:
          sql<number>`coalesce(sum(case when ${journalLines.credit} > 0 then ${journalLines.credit}::numeric else 0 end), 0)`.as(
            "total_out",
          ),
      })
      .from(journalEntries)
      .innerJoin(journalLines, eq(journalLines.entryId, journalEntries.id))
      .innerJoin(ledgerAccounts, eq(journalLines.accountId, ledgerAccounts.id))
      .where(
        and(
          gte(journalEntries.entryDate, dateFrom),
          lte(journalEntries.entryDate, dateTo),
          eq(journalEntries.isReversed, false),
          inArray(ledgerAccounts.code, assetAccounts as [string, ...string[]]),
        ),
      )
      .groupBy(ledgerAccounts.code, ledgerAccounts.name);

    const openingBalanceRows = await db
      .select({
        accountCode: ledgerAccounts.code,
        balance:
          sql<number>`coalesce(sum(${journalLines.debit}::numeric) - sum(${journalLines.credit}::numeric), 0)`.as(
            "balance",
          ),
      })
      .from(journalEntries)
      .innerJoin(journalLines, eq(journalLines.entryId, journalEntries.id))
      .innerJoin(ledgerAccounts, eq(journalLines.accountId, ledgerAccounts.id))
      .where(
        and(
          lt(journalEntries.entryDate, dateFrom),
          eq(journalEntries.isReversed, false),
          inArray(ledgerAccounts.code, assetAccounts as [string, ...string[]]),
        ),
      )
      .groupBy(ledgerAccounts.code);

    const openingBalanceMap = new Map<string, number>();
    for (const row of openingBalanceRows) {
      openingBalanceMap.set(row.accountCode, Math.round(row.balance));
    }

    const byAccount: CashMovementByAccount[] = accountRows.map((row) => {
      const totalIn = Math.round(row.totalIn);
      const totalOut = Math.round(row.totalOut);
      const openingBalance = openingBalanceMap.get(row.accountCode) ?? 0;
      const closingBalance = openingBalance + totalIn - totalOut;

      return {
        accountCode: row.accountCode,
        accountName: row.accountName,
        totalIn,
        totalOut,
        netMovement: totalIn - totalOut,
        openingBalance,
        closingBalance,
      };
    });

    const methodInflowRows = await db
      .select({
        methodId: paymentMethods.id,
        methodName: paymentMethods.name,
        totalIn: sql<number>`coalesce(sum(${projectPayments.amount}::numeric), 0)`.as("total_in"),
      })
      .from(projectPayments)
      .innerJoin(paymentMethods, eq(projectPayments.paymentMethodId, paymentMethods.id))
      .where(
        and(gte(projectPayments.paymentDate, dateFrom), lte(projectPayments.paymentDate, dateTo)),
      )
      .groupBy(paymentMethods.id, paymentMethods.name);

    const methodOutflowRows = await db
      .select({
        methodId: paymentMethods.id,
        methodName: paymentMethods.name,
        totalOut: sql<number>`coalesce(sum(${projectCosts.amount}::numeric), 0)`.as("total_out"),
      })
      .from(projectCosts)
      .innerJoin(paymentMethods, eq(projectCosts.paymentMethodId, paymentMethods.id))
      .where(
        and(
          gte(projectCosts.incurredDate, dateFrom),
          lte(projectCosts.incurredDate, dateTo),
          ne(projectCosts.costType, "material"),
        ),
      )
      .groupBy(paymentMethods.id, paymentMethods.name);

    const allMethods = await db.query.paymentMethods.findMany();

    const inflowMap = new Map<string, number>();
    for (const r of methodInflowRows) {
      inflowMap.set(r.methodId, Math.round(r.totalIn));
    }

    const outflowMap = new Map<string, number>();
    for (const r of methodOutflowRows) {
      outflowMap.set(r.methodId, Math.round(r.totalOut));
    }

    const byMethod: CashMovementByMethod[] = [];
    for (const m of allMethods) {
      const totalIn = inflowMap.get(m.id) ?? 0;
      const totalOut = outflowMap.get(m.id) ?? 0;
      if (totalIn > 0 || totalOut > 0) {
        byMethod.push({
          methodName: m.name,
          totalIn,
          totalOut,
          netMovement: totalIn - totalOut,
        });
      }
    }

    const totalIn = byAccount.reduce((sum, a) => sum + a.totalIn, 0);
    const totalOut = byAccount.reduce((sum, a) => sum + a.totalOut, 0);
    const netMovement = totalIn - totalOut;

    return successResponse({
      periodStart: format(dateFrom, "yyyy-MM-dd"),
      periodEnd: format(dateTo, "yyyy-MM-dd"),
      byAccount,
      byMethod,
      totalIn,
      totalOut,
      netMovement,
    });
  } catch (error) {
    return handleActionError(
      error,
      "getCashMovementReport",
      "Failed to fetch cash movement report",
    );
  }
}
