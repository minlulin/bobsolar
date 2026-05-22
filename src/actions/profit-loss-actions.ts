"use server";

import { endOfDay, format, parseISO, startOfDay, subMonths } from "date-fns";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { requireFinanceAccess } from "@/lib/auth/validate";
import { db } from "@/lib/db";
import { journalEntries, journalLines, ledgerAccounts } from "@/lib/db/schema";
import { type ActionResponse, successResponse } from "@/lib/utils/action-response";
import { handleActionError } from "@/lib/utils/error";

const periodSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export type ProfitLossPeriod = z.input<typeof periodSchema>;

export interface ProfitLossLineItem {
  accountCode: string;
  accountName: string;
  amount: number;
}

export interface ProfitLossSection {
  title: string;
  items: ProfitLossLineItem[];
  total: number;
}

export interface ProfitLossReport {
  periodStart: string;
  periodEnd: string;
  income: ProfitLossSection;
  cogs: ProfitLossSection;
  grossProfit: number;
  expense: ProfitLossSection;
  netProfit: number;
  grossMargin: number;
  netMargin: number;
}

export async function getProfitLossReport(
  rawFilters: unknown = {},
): Promise<ActionResponse<ProfitLossReport>> {
  try {
    await requireFinanceAccess();

    const filters = periodSchema.parse(rawFilters);
    const now = new Date();
    const dateFrom = filters.dateFrom
      ? startOfDay(parseISO(filters.dateFrom))
      : startOfDay(subMonths(now, 11));
    const dateTo = filters.dateTo ? endOfDay(parseISO(filters.dateTo)) : endOfDay(now);

    const incomeAccounts = ["solar_installation_revenue", "other_income"];

    const expenseAccounts = [
      "material_expense",
      "labor_expense",
      "transport_expense",
      "misc_expense",
      "general_expense",
    ];

    const incomeRows = await db
      .select({
        accountCode: ledgerAccounts.code,
        accountName: ledgerAccounts.name,
        amount:
          sql<number>`coalesce(sum(${journalLines.credit}::numeric - ${journalLines.debit}::numeric), 0)`.as(
            "amount",
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
          eq(ledgerAccounts.type, "income"),
        ),
      )
      .groupBy(ledgerAccounts.code, ledgerAccounts.name);

    const expenseRows = await db
      .select({
        accountCode: ledgerAccounts.code,
        accountName: ledgerAccounts.name,
        amount: sql<number>`coalesce(sum(${journalLines.debit}::numeric), 0)`.as("amount"),
      })
      .from(journalEntries)
      .innerJoin(journalLines, eq(journalLines.entryId, journalEntries.id))
      .innerJoin(ledgerAccounts, eq(journalLines.accountId, ledgerAccounts.id))
      .where(
        and(
          gte(journalEntries.entryDate, dateFrom),
          lte(journalEntries.entryDate, dateTo),
          eq(journalEntries.isReversed, false),
          eq(ledgerAccounts.type, "expense"),
        ),
      )
      .groupBy(ledgerAccounts.code, ledgerAccounts.name);

    const cogsAccounts = ["cost_of_goods_sold"];

    const cogsRows = await db
      .select({
        accountCode: ledgerAccounts.code,
        accountName: ledgerAccounts.name,
        amount: sql<number>`coalesce(sum(${journalLines.debit}::numeric), 0)`.as("amount"),
      })
      .from(journalEntries)
      .innerJoin(journalLines, eq(journalLines.entryId, journalEntries.id))
      .innerJoin(ledgerAccounts, eq(journalLines.accountId, ledgerAccounts.id))
      .where(
        and(
          gte(journalEntries.entryDate, dateFrom),
          lte(journalEntries.entryDate, dateTo),
          eq(journalEntries.isReversed, false),
          eq(ledgerAccounts.code, "cost_of_goods_sold"),
        ),
      )
      .groupBy(ledgerAccounts.code, ledgerAccounts.name);

    const incomeItems: ProfitLossLineItem[] = incomeRows
      .filter((row) => incomeAccounts.includes(row.accountCode))
      .map((row) => ({
        accountCode: row.accountCode,
        accountName: row.accountName,
        amount: Math.round(row.amount),
      }));

    const cogsItems: ProfitLossLineItem[] = cogsRows
      .filter((row) => cogsAccounts.includes(row.accountCode))
      .map((row) => ({
        accountCode: row.accountCode,
        accountName: row.accountName,
        amount: Math.round(row.amount),
      }));

    const expenseItems: ProfitLossLineItem[] = expenseRows
      .filter((row) => expenseAccounts.includes(row.accountCode))
      .map((row) => ({
        accountCode: row.accountCode,
        accountName: row.accountName,
        amount: Math.round(row.amount),
      }));

    const totalIncome = incomeItems.reduce((sum, item) => sum + item.amount, 0);
    const totalCogs = cogsItems.reduce((sum, item) => sum + item.amount, 0);
    const grossProfit = totalIncome - totalCogs;
    const totalExpense = expenseItems.reduce((sum, item) => sum + item.amount, 0);
    const netProfit = grossProfit - totalExpense;
    const grossMargin = totalIncome > 0 ? Math.round((grossProfit / totalIncome) * 100) : 0;
    const netMargin = totalIncome > 0 ? Math.round((netProfit / totalIncome) * 100) : 0;

    return successResponse({
      periodStart: format(dateFrom, "yyyy-MM-dd"),
      periodEnd: format(dateTo, "yyyy-MM-dd"),
      income: {
        title: "Income",
        items: incomeItems,
        total: totalIncome,
      },
      cogs: {
        title: "Cost of Goods Sold",
        items: cogsItems,
        total: totalCogs,
      },
      grossProfit,
      expense: {
        title: "Operating Expenses",
        items: expenseItems,
        total: totalExpense,
      },
      netProfit,
      grossMargin,
      netMargin,
    });
  } catch (error) {
    return handleActionError(error, "getProfitLossReport", "Failed to fetch profit & loss report");
  }
}
