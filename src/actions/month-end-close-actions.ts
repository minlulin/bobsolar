"use server";

import { endOfMonth, format, startOfMonth } from "date-fns";
import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { requireOwner } from "@/lib/auth/validate";
import { db } from "@/lib/db";
import {
  accountingPeriods,
  journalEntries,
  journalLines,
  ledgerAccounts,
  projectCosts,
  projectPayments,
  projects,
} from "@/lib/db/schema";
import { COGS_ACCOUNT_CODES, OPERATING_EXPENSE_ACCOUNT_CODES } from "@/lib/domain/finance";
import { type ActionResponse, successResponse } from "@/lib/utils/action-response";
import { handleActionError } from "@/lib/utils/error";

const monthSchema = z.object({
  year: z.number().int(),
  month: z.number().int().min(0).max(11),
});

export type MonthEndCloseInput = z.input<typeof monthSchema>;

export interface CloseCheckItem {
  id: string;
  label: string;
  description: string;
  status: "pass" | "fail" | "warning";
  detail?: string;
}

export interface MonthEndCloseReport {
  month: string;
  checks: CloseCheckItem[];
  allPassed: boolean;
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  projectCount: number;
  paymentCount: number;
  costCount: number;
}

export async function getMonthEndCloseReport(
  rawInput: unknown = {},
): Promise<ActionResponse<MonthEndCloseReport>> {
  try {
    await requireOwner();

    const input = monthSchema.parse(rawInput);
    const monthStart = startOfMonth(new Date(input.year, input.month));
    const monthEnd = endOfMonth(new Date(input.year, input.month));
    const monthLabel = format(monthStart, "MMMM yyyy");
    const periodKey = format(monthStart, "yyyy-MM");

    const [
      paymentsPostedRow,
      costsPostedRow,
      incomeRow,
      expenseRow,
      operationalPaymentsRow,
      operationalCostsRow,
      completedProjectsRow,
      manualAdjustmentsRow,
      periodRow,
    ] = await Promise.all([
      db
        .select({
          sum: sql<number>`coalesce(sum(${journalLines.debit}::numeric), 0)`.as("sum"),
        })
        .from(journalEntries)
        .innerJoin(journalLines, eq(journalLines.entryId, journalEntries.id))
        .innerJoin(ledgerAccounts, eq(journalLines.accountId, ledgerAccounts.id))
        .where(
          and(
            gte(journalEntries.entryDate, monthStart),
            lte(journalEntries.entryDate, monthEnd),
            eq(journalEntries.sourceType, "project_payment"),
            eq(journalEntries.isReversed, false),
            eq(ledgerAccounts.type, "asset"),
          ),
        ),

      db
        .select({
          sum: sql<number>`coalesce(sum(${journalLines.debit}::numeric), 0)`.as("sum"),
        })
        .from(journalEntries)
        .innerJoin(journalLines, eq(journalLines.entryId, journalEntries.id))
        .innerJoin(ledgerAccounts, eq(journalLines.accountId, ledgerAccounts.id))
        .where(
          and(
            gte(journalEntries.entryDate, monthStart),
            lte(journalEntries.entryDate, monthEnd),
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
          sum: sql<number>`coalesce(sum(${journalLines.credit}::numeric - ${journalLines.debit}::numeric), 0)`.as(
            "sum",
          ),
        })
        .from(journalEntries)
        .innerJoin(journalLines, eq(journalLines.entryId, journalEntries.id))
        .innerJoin(ledgerAccounts, eq(journalLines.accountId, ledgerAccounts.id))
        .where(
          and(
            gte(journalEntries.entryDate, monthStart),
            lte(journalEntries.entryDate, monthEnd),
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
            gte(journalEntries.entryDate, monthStart),
            lte(journalEntries.entryDate, monthEnd),
            eq(journalEntries.isReversed, false),
            eq(ledgerAccounts.type, "expense"),
          ),
        ),

      db
        .select({
          sum: sql<number>`coalesce(sum(${projectPayments.amount}::numeric), 0)`.as("sum"),
          count: sql<number>`cast(count(${projectPayments.id}) as int)`.as("count"),
        })
        .from(projectPayments)
        .innerJoin(
          journalEntries,
          and(
            eq(journalEntries.sourceType, "project_payment"),
            eq(journalEntries.sourceId, projectPayments.id),
            eq(journalEntries.isReversed, false),
          ),
        )
        .where(
          and(
            gte(projectPayments.paymentDate, monthStart),
            lte(projectPayments.paymentDate, monthEnd),
          ),
        ),

      db
        .select({
          sum: sql<number>`coalesce(sum(${projectCosts.amount}::numeric), 0)`.as("sum"),
          count: sql<number>`cast(count(${projectCosts.id}) as int)`.as("count"),
        })
        .from(projectCosts)
        .where(
          and(
            gte(projectCosts.incurredDate, monthStart),
            lte(projectCosts.incurredDate, monthEnd),
            eq(projectCosts.isReversed, false),
          ),
        ),

      db
        .select({
          count: sql<number>`count(*)`.as("count"),
        })
        .from(projects)
        .where(
          and(
            eq(projects.status, "completed"),
            gte(projects.actualCompletion, monthStart),
            lte(projects.actualCompletion, monthEnd),
          ),
        ),

      db
        .select({
          count: sql<number>`cast(count(*) as int)`.as("count"),
        })
        .from(journalEntries)
        .where(
          and(
            gte(journalEntries.entryDate, monthStart),
            lte(journalEntries.entryDate, monthEnd),
            eq(journalEntries.sourceType, "manual_adjustment"),
            eq(journalEntries.isReversed, false),
          ),
        ),

      db
        .select({
          status: accountingPeriods.status,
        })
        .from(accountingPeriods)
        .where(eq(accountingPeriods.periodMonth, periodKey)),
    ]);

    const paymentsPosted = paymentsPostedRow[0];
    const costsPosted = costsPostedRow[0];
    const income = incomeRow[0];
    const expense = expenseRow[0];
    const operationalPaymentsResult = operationalPaymentsRow[0];
    const operationalCostsResult = operationalCostsRow[0];
    const completedProjects = completedProjectsRow[0];
    const manualAdjustments = manualAdjustmentsRow[0];
    const period = periodRow[0];

    const manualAdjustmentCount = manualAdjustments?.count ?? 0;
    const periodIsClosed = period?.status === "closed" || period?.status === "soft_closed";

    const totalIncome = Math.round(income?.sum ?? 0);
    const totalExpense = Math.round(expense?.sum ?? 0);
    const postedPaymentsSum = Math.round(paymentsPosted?.sum ?? 0);
    const postedCostsSum = Math.round(costsPosted?.sum ?? 0);
    const operationalPayments = Math.round(operationalPaymentsResult?.sum ?? 0);
    const operationalCosts = Math.round(operationalCostsResult?.sum ?? 0);
    const projectCount = completedProjects?.count ?? 0;

    const incomeMatch = postedPaymentsSum === operationalPayments;
    const expenseMatch = postedCostsSum === operationalCosts;

    const checks: CloseCheckItem[] = [
      {
        id: "payments-posted",
        label: "All project payments posted",
        description:
          "Asset-debit side of payment journal entries matches non-reversed operational payment totals",
        status: incomeMatch ? "pass" : "fail",
        detail: incomeMatch
          ? `Journal: ${postedPaymentsSum.toLocaleString()} = Payments: ${operationalPayments.toLocaleString()}`
          : `Journal: ${postedPaymentsSum.toLocaleString()} ≠ Payments: ${operationalPayments.toLocaleString()}`,
      },
      {
        id: "costs-posted",
        label: "All project costs posted",
        description: "Journal expense matches non-reversed operational cost totals",
        status: expenseMatch ? "pass" : "fail",
        detail: expenseMatch
          ? `Journal: ${postedCostsSum.toLocaleString()} = Costs: ${operationalCosts.toLocaleString()}`
          : `Journal: ${postedCostsSum.toLocaleString()} ≠ Costs: ${operationalCosts.toLocaleString()}`,
      },
      {
        id: "no-manual-adjustments",
        label: "No unreviewed manual adjustments",
        description: "Manual journal entries in this period have been reviewed",
        status: manualAdjustmentCount === 0 ? "pass" : "warning",
        detail:
          manualAdjustmentCount === 0
            ? "No manual adjustments found"
            : `${manualAdjustmentCount} manual adjustment entry(s) require review`,
      },
      {
        id: "close-snapshot",
        label: "Accounting period closed",
        description:
          "An accounting period record exists and is closed or soft-closed for this month",
        status: periodIsClosed ? "pass" : "warning",
        detail: periodIsClosed
          ? `Period ${periodKey} is ${period?.status}`
          : `No closed accounting period found for ${periodKey}. Create one via Finance \u2192 Month-End Close.`,
      },
    ];

    const allPassed = checks.every((c) => c.status === "pass");

    return successResponse({
      month: monthLabel,
      checks,
      allPassed,
      totalIncome,
      totalExpense,
      netProfit: totalIncome - totalExpense,
      projectCount,
      paymentCount: operationalPaymentsResult?.count ?? 0,
      costCount: operationalCostsResult?.count ?? 0,
    });
  } catch (error) {
    return handleActionError(
      error,
      "getMonthEndCloseReport",
      "Failed to fetch month-end close report",
    );
  }
}
