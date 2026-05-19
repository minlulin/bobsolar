"use server";

import { endOfDay, format, parseISO, startOfDay, startOfMonth, subMonths } from "date-fns";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/validate";
import { db } from "@/lib/db";
import {
  customers,
  journalEntries,
  journalLines,
  ledgerAccounts,
  projectCosts,
  projectPayments,
  projects,
} from "@/lib/db/schema";
import { type ActionResponse, successResponse } from "@/lib/utils/action-response";
import { handleActionError } from "@/lib/utils/error";

const periodFilterSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export type FinancePeriodFilter = z.input<typeof periodFilterSchema>;
export type FinancePeriodFilterParsed = z.output<typeof periodFilterSchema>;

export interface FinanceSummaryCard {
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  accountsReceivable: number;
  cashBalance: number;
  walletBalance: number;
  bankBalance: number;
}

export async function getFinanceSummary(
  rawFilters: unknown = {},
): Promise<ActionResponse<FinanceSummaryCard>> {
  try {
    await requireAuth();

    const filters = periodFilterSchema.parse(rawFilters);
    const dateFrom = filters.dateFrom
      ? startOfDay(parseISO(filters.dateFrom))
      : startOfMonth(subMonths(new Date(), 11));
    const dateTo = filters.dateTo ? endOfDay(parseISO(filters.dateTo)) : new Date();

    const [incomeRow] = await db
      .select({
        sum: sql<number>`coalesce(sum(${journalLines.debit}::numeric), 0)`.as("sum"),
      })
      .from(journalEntries)
      .innerJoin(journalLines, eq(journalLines.entryId, journalEntries.id))
      .innerJoin(ledgerAccounts, eq(journalLines.accountId, ledgerAccounts.id))
      .where(
        and(
          gte(journalEntries.entryDate, dateFrom),
          lte(journalEntries.entryDate, dateTo),
          eq(journalEntries.sourceType, "project_payment"),
          eq(journalEntries.isReversed, false),
          eq(ledgerAccounts.code, "solar_installation_revenue"),
        ),
      );

    const [expenseRow] = await db
      .select({
        sum: sql<number>`coalesce(sum(${journalLines.debit}::numeric), 0)`.as("sum"),
      })
      .from(journalEntries)
      .innerJoin(journalLines, eq(journalLines.entryId, journalEntries.id))
      .innerJoin(ledgerAccounts, eq(journalLines.accountId, ledgerAccounts.id))
      .where(
        and(
          gte(journalEntries.entryDate, dateFrom),
          lte(journalEntries.entryDate, dateTo),
          eq(journalEntries.sourceType, "project_expense"),
          eq(journalEntries.isReversed, false),
          inArray(ledgerAccounts.code, [
            "material_expense",
            "labor_expense",
            "transport_expense",
            "misc_expense",
          ]),
        ),
      );

    const [arRow] = await db
      .select({
        sum: sql<number>`coalesce(sum(${journalLines.debit}::numeric) - sum(${journalLines.credit}::numeric), 0)`.as(
          "sum",
        ),
      })
      .from(journalLines)
      .innerJoin(ledgerAccounts, eq(journalLines.accountId, ledgerAccounts.id))
      .where(eq(ledgerAccounts.code, "accounts_receivable"));

    const assetBalances = await db
      .select({
        accountCode: ledgerAccounts.code,
        balance:
          sql<number>`coalesce(sum(${journalLines.debit}::numeric) - sum(${journalLines.credit}::numeric), 0)`.as(
            "balance",
          ),
      })
      .from(journalLines)
      .innerJoin(ledgerAccounts, eq(journalLines.accountId, ledgerAccounts.id))
      .where(
        inArray(ledgerAccounts.code, [
          "cash_on_hand",
          "kbz_wallet",
          "wave_wallet",
          "aya_wallet",
          "bank_account",
        ]),
      )
      .groupBy(ledgerAccounts.code);

    const balanceMap = new Map<string, number>();
    for (const row of assetBalances) {
      balanceMap.set(row.accountCode, row.balance);
    }

    const totalIncome = Math.round(incomeRow?.sum ?? 0);
    const totalExpense = Math.round(expenseRow?.sum ?? 0);
    const netProfit = totalIncome - totalExpense;
    const accountsReceivable = Math.round(arRow?.sum ?? 0);
    const cashBalance = Math.round(balanceMap.get("cash_on_hand") ?? 0);
    const walletBalance = Math.round(
      (balanceMap.get("kbz_wallet") ?? 0) +
        (balanceMap.get("wave_wallet") ?? 0) +
        (balanceMap.get("aya_wallet") ?? 0),
    );
    const bankBalance = Math.round(balanceMap.get("bank_account") ?? 0);

    return successResponse({
      totalIncome,
      totalExpense,
      netProfit,
      accountsReceivable,
      cashBalance,
      walletBalance,
      bankBalance,
    });
  } catch (error) {
    return handleActionError(error, "getFinanceSummary", "Failed to fetch finance summary");
  }
}

export interface MonthlyTrendRow {
  month: string;
  income: number;
  expense: number;
}

export async function getMonthlyTrend(
  rawFilters: unknown = {},
): Promise<ActionResponse<MonthlyTrendRow[]>> {
  try {
    await requireAuth();

    const filters = periodFilterSchema.parse(rawFilters);
    const dateFrom = filters.dateFrom
      ? startOfDay(parseISO(filters.dateFrom))
      : startOfMonth(subMonths(new Date(), 11));
    const dateTo = filters.dateTo ? endOfDay(parseISO(filters.dateTo)) : new Date();

    const incomeRows = await db
      .select({
        month: sql<string>`to_char(${journalEntries.entryDate}, 'YYYY-MM')`.as("month"),
        amount: sql<string>`coalesce(sum(${journalLines.debit}::numeric), 0)`.as("amount"),
      })
      .from(journalEntries)
      .innerJoin(journalLines, eq(journalLines.entryId, journalEntries.id))
      .innerJoin(ledgerAccounts, eq(journalLines.accountId, ledgerAccounts.id))
      .where(
        and(
          gte(journalEntries.entryDate, dateFrom),
          lte(journalEntries.entryDate, dateTo),
          eq(journalEntries.sourceType, "project_payment"),
          eq(journalEntries.isReversed, false),
          eq(ledgerAccounts.code, "solar_installation_revenue"),
        ),
      )
      .groupBy(sql`to_char(${journalEntries.entryDate}, 'YYYY-MM')`);

    const expenseRows = await db
      .select({
        month: sql<string>`to_char(${journalEntries.entryDate}, 'YYYY-MM')`.as("month"),
        amount: sql<string>`coalesce(sum(${journalLines.debit}::numeric), 0)`.as("amount"),
      })
      .from(journalEntries)
      .innerJoin(journalLines, eq(journalLines.entryId, journalEntries.id))
      .innerJoin(ledgerAccounts, eq(journalLines.accountId, ledgerAccounts.id))
      .where(
        and(
          gte(journalEntries.entryDate, dateFrom),
          lte(journalEntries.entryDate, dateTo),
          eq(journalEntries.sourceType, "project_expense"),
          eq(journalEntries.isReversed, false),
          inArray(ledgerAccounts.code, [
            "material_expense",
            "labor_expense",
            "transport_expense",
            "misc_expense",
          ]),
        ),
      )
      .groupBy(sql`to_char(${journalEntries.entryDate}, 'YYYY-MM')`);

    const incomeMap = new Map<string, number>();
    for (const row of incomeRows) {
      incomeMap.set(row.month, Math.round(Number(row.amount)));
    }

    const expenseMap = new Map<string, number>();
    for (const row of expenseRows) {
      expenseMap.set(row.month, Math.round(Number(row.amount)));
    }

    const months: MonthlyTrendRow[] = [];
    let current = startOfDay(dateFrom);
    while (current <= dateTo) {
      const key = format(current, "yyyy-MM");
      months.push({
        month: key,
        income: incomeMap.get(key) ?? 0,
        expense: expenseMap.get(key) ?? 0,
      });
      current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    }

    return successResponse(months);
  } catch (error) {
    return handleActionError(error, "getMonthlyTrend", "Failed to fetch monthly trend");
  }
}

export interface ExpenseBreakdownRow {
  type: string;
  label: string;
  amount: number;
  percentage: number;
}

export async function getExpenseBreakdown(
  rawFilters: unknown = {},
): Promise<ActionResponse<ExpenseBreakdownRow[]>> {
  try {
    await requireAuth();

    const filters = periodFilterSchema.parse(rawFilters);
    const dateFrom = filters.dateFrom
      ? startOfDay(parseISO(filters.dateFrom))
      : startOfMonth(subMonths(new Date(), 11));
    const dateTo = filters.dateTo ? endOfDay(parseISO(filters.dateTo)) : new Date();

    const typeLabels: Record<string, string> = {
      material_expense: "Materials",
      labor_expense: "Labor",
      transport_expense: "Logistics",
      misc_expense: "Miscellaneous",
    };

    const rows = await db
      .select({
        accountCode: ledgerAccounts.code,
        amount: sql<string>`coalesce(sum(${journalLines.debit}::numeric), 0)`.as("amount"),
      })
      .from(journalEntries)
      .innerJoin(journalLines, eq(journalLines.entryId, journalEntries.id))
      .innerJoin(ledgerAccounts, eq(journalLines.accountId, ledgerAccounts.id))
      .where(
        and(
          gte(journalEntries.entryDate, dateFrom),
          lte(journalEntries.entryDate, dateTo),
          eq(journalEntries.sourceType, "project_expense"),
          eq(journalEntries.isReversed, false),
          inArray(ledgerAccounts.code, [
            "material_expense",
            "labor_expense",
            "transport_expense",
            "misc_expense",
          ]),
        ),
      )
      .groupBy(ledgerAccounts.code);

    const breakdown: ExpenseBreakdownRow[] = [];
    let total = 0;

    for (const row of rows) {
      const amount = Math.round(Number(row.amount));
      total += amount;
      breakdown.push({
        type: row.accountCode,
        label: typeLabels[row.accountCode] ?? row.accountCode,
        amount,
        percentage: 0,
      });
    }

    if (total > 0) {
      for (const item of breakdown) {
        item.percentage = Math.round((item.amount / total) * 100);
      }
    }

    breakdown.sort((a, b) => b.amount - a.amount);

    return successResponse(breakdown);
  } catch (error) {
    return handleActionError(error, "getExpenseBreakdown", "Failed to fetch expense breakdown");
  }
}

export interface ReceivableRiskProject {
  projectId: string;
  projectNumber: string;
  customerName: string;
  quotedTotal: number;
  paidAmount: number;
  outstanding: number;
  daysOverdue: number;
  status: string;
}

export async function getReceivableRiskData(): Promise<ActionResponse<ReceivableRiskProject[]>> {
  try {
    await requireAuth();

    const rows = await db
      .select({
        projectId: projects.id,
        projectNumber: projects.projectNumber,
        customerName: customers.name,
        quotedTotal: projects.quotedTotal,
        status: projects.status,
        actualCompletion: projects.actualCompletion,
        paidAmount: sql<string>`coalesce(sum(${projectPayments.amount}::numeric), 0)`.as(
          "paid_amount",
        ),
      })
      .from(projects)
      .innerJoin(customers, eq(projects.customerId, customers.id))
      .leftJoin(projectPayments, eq(projectPayments.projectId, projects.id))
      .where(eq(projects.status, "completed"))
      .groupBy(
        projects.id,
        projects.projectNumber,
        customers.name,
        projects.quotedTotal,
        projects.status,
        projects.actualCompletion,
      )
      .orderBy(desc(projects.actualCompletion));

    const riskProjects: ReceivableRiskProject[] = [];
    const now = new Date();

    for (const row of rows) {
      const quoted = Math.round(Number(row.quotedTotal));
      const paid = Math.round(Number(row.paidAmount));
      const outstanding = quoted - paid;

      if (outstanding <= 0) continue;

      let daysOverdue = 0;
      if (row.actualCompletion) {
        const completionDate = new Date(row.actualCompletion);
        const daysSinceCompletion = Math.floor(
          (now.getTime() - completionDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        daysOverdue = Math.max(0, daysSinceCompletion - 30);
      }

      riskProjects.push({
        projectId: row.projectId,
        projectNumber: row.projectNumber,
        customerName: row.customerName ?? "Unknown",
        quotedTotal: quoted,
        paidAmount: paid,
        outstanding,
        daysOverdue,
        status: row.status,
      });
    }

    riskProjects.sort((a, b) => b.outstanding - a.outstanding);

    return successResponse(riskProjects);
  } catch (error) {
    return handleActionError(
      error,
      "getReceivableRiskData",
      "Failed to fetch receivable risk data",
    );
  }
}

export interface DataConsistencyCheck {
  journalIncome: number;
  operationalPayments: number;
  incomeMatch: boolean;
  journalExpense: number;
  operationalCosts: number;
  expenseMatch: boolean;
  discrepancies: string[];
}

export async function getDataConsistencyCheck(): Promise<ActionResponse<DataConsistencyCheck>> {
  try {
    await requireAuth();

    const [journalIncomeRow] = await db
      .select({
        sum: sql<number>`coalesce(sum(${journalLines.debit}::numeric), 0)`.as("sum"),
      })
      .from(journalEntries)
      .innerJoin(journalLines, eq(journalLines.entryId, journalEntries.id))
      .where(
        and(eq(journalEntries.sourceType, "project_payment"), eq(journalEntries.isReversed, false)),
      );

    const [operationalPaymentsRow] = await db
      .select({
        sum: sql<number>`coalesce(sum(${projectPayments.amount}::numeric), 0)`.as("sum"),
      })
      .from(projectPayments);

    const [journalExpenseRow] = await db
      .select({
        sum: sql<number>`coalesce(sum(${journalLines.debit}::numeric), 0)`.as("sum"),
      })
      .from(journalEntries)
      .innerJoin(journalLines, eq(journalLines.entryId, journalEntries.id))
      .where(
        and(eq(journalEntries.sourceType, "project_expense"), eq(journalEntries.isReversed, false)),
      );

    const [operationalCostsRow] = await db
      .select({
        sum: sql<number>`coalesce(sum(${projectCosts.amount}::numeric), 0)`.as("sum"),
      })
      .from(projectCosts);

    const journalIncome = Math.round(journalIncomeRow?.sum ?? 0);
    const operationalPayments = Math.round(operationalPaymentsRow?.sum ?? 0);
    const journalExpense = Math.round(journalExpenseRow?.sum ?? 0);
    const operationalCosts = Math.round(operationalCostsRow?.sum ?? 0);

    const discrepancies: string[] = [];
    if (journalIncome !== operationalPayments) {
      discrepancies.push(
        `Income mismatch: Journal ${journalIncome.toLocaleString()} vs Payments ${operationalPayments.toLocaleString()}`,
      );
    }
    if (journalExpense !== operationalCosts) {
      discrepancies.push(
        `Expense mismatch: Journal ${journalExpense.toLocaleString()} vs Costs ${operationalCosts.toLocaleString()}`,
      );
    }

    return successResponse({
      journalIncome,
      operationalPayments,
      incomeMatch: journalIncome === operationalPayments,
      journalExpense,
      operationalCosts,
      expenseMatch: journalExpense === operationalCosts,
      discrepancies,
    });
  } catch (error) {
    return handleActionError(error, "getDataConsistencyCheck", "Failed to check data consistency");
  }
}
