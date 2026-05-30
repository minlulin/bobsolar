"use server";

import { endOfDay, format, parseISO, startOfDay, startOfMonth, subMonths } from "date-fns";
import { and, desc, eq, gte, inArray, lte, notInArray, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { requireFinanceAccess } from "@/lib/auth/validate";
import { db } from "@/lib/db";

import {
  customers,
  journalEntries,
  journalLines,
  ledgerAccounts,
  projectCosts,
  projectInvoices,
  projectPayments,
  projects,
} from "@/lib/db/schema";
import type { LedgerAccountCode } from "@/lib/domain/finance";
import {
  CASH_ACCOUNT_CODES,
  CASH_ACCOUNT_GROUPS,
  COGS_ACCOUNT_CODES,
  CURRENT_LIABILITY_ACCOUNT_CODES,
  EXPENSE_ACCOUNT_SHORT_LABELS,
  LEDGER_ACCOUNT_LABELS,
  OPERATING_EXPENSE_ACCOUNT_CODES,
  type OperatingExpenseAccountCode,
} from "@/lib/domain/finance";
import { recordFinanceDashboardLatency, recordJournalPostFailure } from "@/lib/finance/metrics";
import { type ActionResponse, successResponse } from "@/lib/utils/action-response";
import { handleActionError } from "@/lib/utils/error";
import { periodFilterSchema } from "@/lib/validators/finance";

export type { FinancePeriodFilter, FinancePeriodFilterParsed } from "@/lib/validators/finance";

export interface FinanceSummaryCard {
  totalIncome: number;
  totalCogs: number;
  grossProfit: number;
  totalExpense: number;
  netProfit: number;
  accountsReceivable: number;
  cashBalance: number;
  walletBalance: number;
  bankBalance: number;
  grossProfitMargin: number;
  netProfitMargin: number;
  averageDebtorDays: number;
  currentRatio: number;
  workingCapital: number;
  netCashPosition: number;
  cashAccounts: { code: string; balance: number }[];
}

const ACTIVE_PROJECT_STATUSES = [
  "planning",
  "in_progress",
  "on_hold",
  "installation_completed",
  "completed",
] as const;

const getCachedFinanceSummary = unstable_cache(
  async (
    dateFrom: Date,
    dateTo: Date,
  ): Promise<Omit<FinanceSummaryCard, "cashAccounts"> & { balanceMap: Map<string, number> }> => {
    const [incomeRow, expenseRow, arRow, assetBalances, cogsRow, liabilityRow] = await Promise.all([
      db
        .select({
          sum: sql<number>`coalesce(sum(${journalLines.credit}::numeric - ${journalLines.debit}::numeric), 0)`.as(
            "sum",
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
        ),

      db
        .select({
          sum: sql<number>`coalesce(sum(${journalLines.debit}::numeric - ${journalLines.credit}::numeric), 0)`.as(
            "sum",
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
            eq(ledgerAccounts.type, "expense"),
            notInArray(ledgerAccounts.code, [...COGS_ACCOUNT_CODES]),
          ),
        ),

      db
        .select({
          amount: sql<number>`coalesce(sum(greatest(
            cast(${projects.quotedTotal} as numeric) - coalesce(pay.total, 0),
            0
          )), 0)`.as("amount"),
        })
        .from(projects)
        .leftJoin(
          db
            .select({
              projectId: projectPayments.projectId,
              total: sql<number>`sum(cast(${projectPayments.amount} as numeric))`.as("total"),
            })
            .from(projectPayments)
            .groupBy(projectPayments.projectId)
            .as("pay"),
          eq(projects.id, sql`pay.project_id`),
        )
        .where(inArray(projects.status, [...ACTIVE_PROJECT_STATUSES])),

      db
        .select({
          accountCode: ledgerAccounts.code,
          balance:
            sql<number>`coalesce(sum(${journalLines.debit}::numeric) - sum(${journalLines.credit}::numeric), 0)`.as(
              "balance",
            ),
        })
        .from(journalLines)
        .innerJoin(ledgerAccounts, eq(journalLines.accountId, ledgerAccounts.id))
        .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
        .where(
          and(
            inArray(ledgerAccounts.code, [...CASH_ACCOUNT_CODES]),
            gte(journalEntries.entryDate, dateFrom),
            lte(journalEntries.entryDate, dateTo),
            eq(journalEntries.isReversed, false),
          ),
        )
        .groupBy(ledgerAccounts.code),

      db
        .select({
          sum: sql<number>`coalesce(sum(${journalLines.debit}::numeric - ${journalLines.credit}::numeric), 0)`.as(
            "sum",
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
            inArray(ledgerAccounts.code, [...COGS_ACCOUNT_CODES]),
          ),
        ),

      db
        .select({
          balance:
            sql<number>`coalesce(sum(${journalLines.credit}::numeric) - sum(${journalLines.debit}::numeric), 0)`.as(
              "balance",
            ),
        })
        .from(journalLines)
        .innerJoin(ledgerAccounts, eq(journalLines.accountId, ledgerAccounts.id))
        .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
        .where(
          and(
            inArray(ledgerAccounts.code, [...CURRENT_LIABILITY_ACCOUNT_CODES]),
            gte(journalEntries.entryDate, dateFrom),
            lte(journalEntries.entryDate, dateTo),
            eq(journalEntries.isReversed, false),
          ),
        ),
    ]);

    const balanceMap = new Map<string, number>();
    for (const row of assetBalances) {
      balanceMap.set(row.accountCode, row.balance);
    }

    function sumGroup(codes: readonly string[]): number {
      let total = 0;
      for (const code of codes) total += balanceMap.get(code) ?? 0;
      return Math.round(total);
    }

    const totalIncome = Math.round(incomeRow[0]?.sum ?? 0);
    const totalCogs = Math.round(cogsRow[0]?.sum ?? 0);
    const grossProfit = totalIncome - totalCogs;
    const totalExpense = Math.round(expenseRow[0]?.sum ?? 0);
    const netProfit = grossProfit - totalExpense;
    const accountsReceivable = Math.round(arRow[0]?.amount ?? 0);
    const cashBalance = sumGroup(CASH_ACCOUNT_GROUPS.cash);
    const walletBalance = sumGroup(CASH_ACCOUNT_GROUPS.wallet);
    const bankBalance = sumGroup(CASH_ACCOUNT_GROUPS.banking);

    const grossProfitMargin = totalIncome > 0 ? Math.round((grossProfit / totalIncome) * 100) : 0;
    const netProfitMargin = totalIncome > 0 ? Math.round((netProfit / totalIncome) * 100) : 0;

    const periodDays = Math.max(
      1,
      Math.floor((dateTo.getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24)),
    );
    const annualizedIncome = totalIncome > 0 ? (totalIncome / periodDays) * 365 : 0;
    const averageDebtorDays =
      annualizedIncome > 0 ? Math.round((accountsReceivable / annualizedIncome) * 365) : 0;

    const totalCurrentAssets = cashBalance + walletBalance + bankBalance + accountsReceivable;
    const totalCurrentLiabilities = Math.round(Number(liabilityRow[0]?.balance ?? 0));
    const currentRatio =
      totalCurrentLiabilities > 0
        ? Math.round((totalCurrentAssets / totalCurrentLiabilities) * 100) / 100
        : totalCurrentAssets > 0
          ? 999.99
          : 0;

    const workingCapital = totalCurrentAssets - totalCurrentLiabilities;
    const netCashPosition = cashBalance + walletBalance + bankBalance;

    return {
      totalIncome,
      totalCogs,
      grossProfit,
      totalExpense,
      netProfit,
      accountsReceivable,
      cashBalance,
      walletBalance,
      bankBalance,
      grossProfitMargin,
      netProfitMargin,
      averageDebtorDays,
      currentRatio,
      workingCapital,
      netCashPosition,
      balanceMap,
    };
  },
  ["finance:summary"],
  { tags: ["finance"], revalidate: 300 },
);

export async function getFinanceSummary(
  rawFilters: unknown = {},
): Promise<ActionResponse<FinanceSummaryCard>> {
  const start = performance.now();
  try {
    await requireFinanceAccess();

    const filters = periodFilterSchema.parse(rawFilters);
    const dateFrom = filters.dateFrom
      ? startOfDay(parseISO(filters.dateFrom))
      : startOfMonth(subMonths(new Date(), 11));
    const dateTo = filters.dateTo ? endOfDay(parseISO(filters.dateTo)) : new Date();

    const cached = await getCachedFinanceSummary(dateFrom, dateTo);
    const { balanceMap, ...rest } = cached;

    const cashAccounts = CASH_ACCOUNT_CODES.map((code) => ({
      code,
      balance: Math.round(balanceMap.get(code) ?? 0),
    }));

    try {
      recordFinanceDashboardLatency(Math.round(performance.now() - start));
    } catch (metricError: unknown) {
      console.error("[finance.summary.metrics]", metricError);
    }
    return successResponse({ ...rest, cashAccounts });
  } catch (error) {
    recordJournalPostFailure(error instanceof Error ? error.message : String(error));
    return handleActionError(error, "getFinanceSummary", "Failed to fetch finance summary");
  }
}

export type MonthlyTrendRow = {
  month: string;
  income: number;
  expense: number;
};

const getCachedMonthlyTrend = unstable_cache(
  async (
    dateFrom: Date,
    dateTo: Date,
  ): Promise<{ month: string; income: number; expense: number }[]> => {
    const [incomeRows, expenseRows] = await Promise.all([
      db
        .select({
          month: sql<string>`to_char(${journalEntries.entryDate}, 'YYYY-MM')`.as("month"),
          amount:
            sql<string>`coalesce(sum(${journalLines.credit}::numeric - ${journalLines.debit}::numeric), 0)`.as(
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
        .groupBy(sql`to_char(${journalEntries.entryDate}, 'YYYY-MM')`),

      db
        .select({
          month: sql<string>`to_char(${journalEntries.entryDate}, 'YYYY-MM')`.as("month"),
          amount:
            sql<string>`coalesce(sum(${journalLines.debit}::numeric - ${journalLines.credit}::numeric), 0)`.as(
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
            eq(ledgerAccounts.type, "expense"),
            notInArray(ledgerAccounts.code, [...COGS_ACCOUNT_CODES]),
          ),
        )
        .groupBy(sql`to_char(${journalEntries.entryDate}, 'YYYY-MM')`),
    ]);

    const incomeMap = new Map<string, number>();
    for (const row of incomeRows) {
      incomeMap.set(row.month, Math.round(Number(row.amount)));
    }

    const expenseMap = new Map<string, number>();
    for (const row of expenseRows) {
      expenseMap.set(row.month, Math.round(Number(row.amount)));
    }

    const months: { month: string; income: number; expense: number }[] = [];
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

    return months;
  },
  ["finance:monthly-trend"],
  { tags: ["finance"], revalidate: 300 },
);

export async function getMonthlyTrend(
  rawFilters: unknown = {},
): Promise<ActionResponse<MonthlyTrendRow[]>> {
  try {
    await requireFinanceAccess();

    const filters = periodFilterSchema.parse(rawFilters);
    const dateFrom = filters.dateFrom
      ? startOfDay(parseISO(filters.dateFrom))
      : startOfMonth(subMonths(new Date(), 11));
    const dateTo = filters.dateTo ? endOfDay(parseISO(filters.dateTo)) : new Date();

    const months = await getCachedMonthlyTrend(dateFrom, dateTo);
    return successResponse(months);
  } catch (error) {
    return handleActionError(error, "getMonthlyTrend", "Failed to fetch monthly trend");
  }
}

export interface ExpenseBreakdownRow {
  type: LedgerAccountCode;
  label: string;
  amount: number;
  percentage: number;
}

const getCachedExpenseBreakdown = unstable_cache(
  async (dateFrom: Date, dateTo: Date): Promise<{ accountCode: string; amount: number }[]> => {
    const rows = await db
      .select({
        accountCode: ledgerAccounts.code,
        amount:
          sql<string>`coalesce(sum(${journalLines.debit}::numeric - ${journalLines.credit}::numeric), 0)`.as(
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
          eq(ledgerAccounts.type, "expense"),
          notInArray(ledgerAccounts.code, [...COGS_ACCOUNT_CODES]),
        ),
      )
      .groupBy(ledgerAccounts.code);

    return rows.map((row) => ({
      accountCode: row.accountCode,
      amount: Math.round(Number(row.amount)),
    }));
  },
  ["finance:expense-breakdown"],
  { tags: ["finance"], revalidate: 300 },
);

export async function getExpenseBreakdown(
  rawFilters: unknown = {},
): Promise<ActionResponse<ExpenseBreakdownRow[]>> {
  try {
    await requireFinanceAccess();

    const filters = periodFilterSchema.parse(rawFilters);
    const dateFrom = filters.dateFrom
      ? startOfDay(parseISO(filters.dateFrom))
      : startOfMonth(subMonths(new Date(), 11));
    const dateTo = filters.dateTo ? endOfDay(parseISO(filters.dateTo)) : new Date();

    const rows = await getCachedExpenseBreakdown(dateFrom, dateTo);

    const breakdown: ExpenseBreakdownRow[] = [];
    let total = 0;

    for (const row of rows) {
      total += row.amount;
      breakdown.push({
        type: row.accountCode as LedgerAccountCode,
        label:
          EXPENSE_ACCOUNT_SHORT_LABELS[row.accountCode as OperatingExpenseAccountCode] ??
          LEDGER_ACCOUNT_LABELS[row.accountCode as LedgerAccountCode] ??
          row.accountCode,
        amount: row.amount,
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

export interface ReceivableRiskInvoice {
  invoiceId: string;
  invoiceNumber: string;
  projectId: string;
  projectNumber: string;
  customerName: string;
  totalAmount: number;
  paidAmount: number;
  outstanding: number;
  daysOverdue: number;
  status: string;
}

export async function getReceivableRiskData(): Promise<ActionResponse<ReceivableRiskInvoice[]>> {
  try {
    await requireFinanceAccess();

    const rows = await db
      .select({
        invoiceId: projectInvoices.id,
        invoiceNumber: projectInvoices.invoiceNumber,
        projectId: projects.id,
        projectNumber: projects.projectNumber,
        customerName: customers.name,
        totalAmount: projectInvoices.total,
        paidAmount: projectInvoices.paidAmount,
        balanceDue: projectInvoices.balanceDue,
        dueDate: projectInvoices.dueDate,
        status: projectInvoices.status,
      })
      .from(projectInvoices)
      .innerJoin(projects, eq(projectInvoices.projectId, projects.id))
      .innerJoin(customers, eq(projectInvoices.customerId, customers.id))
      .where(sql`${projectInvoices.balanceDue} > 0`)
      .orderBy(desc(projectInvoices.dueDate));

    const riskInvoices: ReceivableRiskInvoice[] = [];
    const now = new Date();

    for (const row of rows) {
      const total = Math.round(Number(row.totalAmount));
      const paid = Math.round(Number(row.paidAmount));
      const outstanding = Math.round(Number(row.balanceDue));

      if (outstanding <= 0 || row.status === "draft" || row.status === "voided") continue;

      let daysOverdue = 0;
      if (row.dueDate) {
        const dueDate = new Date(row.dueDate);
        const daysSinceDue = Math.floor(
          (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        daysOverdue = Math.max(0, daysSinceDue);
      }

      riskInvoices.push({
        invoiceId: row.invoiceId,
        invoiceNumber: row.invoiceNumber,
        projectId: row.projectId,
        projectNumber: row.projectNumber,
        customerName: row.customerName ?? "Unknown",
        totalAmount: total,
        paidAmount: paid,
        outstanding,
        daysOverdue,
        status: row.status,
      });
    }

    riskInvoices.sort((a, b) => b.outstanding - a.outstanding);

    return successResponse(riskInvoices);
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
    await requireFinanceAccess();

    const [journalIncomeRow, operationalPaymentsRow, journalExpenseRow, operationalCostsRow] =
      await Promise.all([
        db
          .select({
            sum: sql<number>`coalesce(sum(${journalLines.credit}::numeric), 0)`.as("sum"),
          })
          .from(journalEntries)
          .innerJoin(journalLines, eq(journalLines.entryId, journalEntries.id))
          .innerJoin(ledgerAccounts, eq(journalLines.accountId, ledgerAccounts.id))
          .where(
            and(
              eq(journalEntries.sourceType, "project_payment"),
              eq(journalEntries.isReversed, false),
              eq(ledgerAccounts.code, "accounts_receivable"),
            ),
          ),

        db
          .select({
            sum: sql<number>`coalesce(sum(${projectPayments.amount}::numeric), 0)`.as("sum"),
          })
          .from(projectPayments),

        db
          .select({
            sum: sql<number>`coalesce(sum(${journalLines.debit}::numeric), 0)`.as("sum"),
          })
          .from(journalEntries)
          .innerJoin(journalLines, eq(journalLines.entryId, journalEntries.id))
          .innerJoin(ledgerAccounts, eq(journalLines.accountId, ledgerAccounts.id))
          .where(
            and(
              inArray(journalEntries.sourceType, ["project_expense", "inventory_consumption"]),
              eq(journalEntries.isReversed, false),
              inArray(ledgerAccounts.code, [
                ...OPERATING_EXPENSE_ACCOUNT_CODES,
                ...COGS_ACCOUNT_CODES,
              ]),
            ),
          ),

        db
          .select({
            sum: sql<number>`coalesce(sum(${projectCosts.amount}::numeric), 0)`.as("sum"),
          })
          .from(projectCosts),
      ]);

    const journalIncome = Math.round(journalIncomeRow[0]?.sum ?? 0);
    const operationalPayments = Math.round(operationalPaymentsRow[0]?.sum ?? 0);
    const journalExpense = Math.round(journalExpenseRow[0]?.sum ?? 0);
    const operationalCosts = Math.round(operationalCostsRow[0]?.sum ?? 0);

    const discrepancies: string[] = [];
    if (journalIncome !== operationalPayments) {
      discrepancies.push(
        `Collection mismatch: AR Collection Journal ${journalIncome.toLocaleString()} vs Payment Subledger ${operationalPayments.toLocaleString()}`,
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
