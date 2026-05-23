"use server";

import { endOfMonth, format, startOfMonth } from "date-fns";
import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { requireFinanceAccess } from "@/lib/auth/validate";
import { db } from "@/lib/db";
import {
  journalEntries,
  journalLines,
  ledgerAccounts,
  projectCosts,
  projectPayments,
  projects,
} from "@/lib/db/schema";
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
    await requireFinanceAccess();

    const input = monthSchema.parse(rawInput);
    const monthStart = startOfMonth(new Date(input.year, input.month));
    const monthEnd = endOfMonth(new Date(input.year, input.month));
    const monthLabel = format(monthStart, "MMMM yyyy");

    const [paymentsPostedRow] = await db
      .select({
        sum: sql<number>`coalesce(sum(${journalLines.credit}::numeric), 0)`.as("sum"),
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
          eq(ledgerAccounts.code, "accounts_receivable"),
        ),
      );

    const [costsPostedRow] = await db
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
          eq(journalEntries.sourceType, "project_expense"),
          eq(journalEntries.isReversed, false),
          inArray(ledgerAccounts.code, [
            "material_expense",
            "labor_expense",
            "transport_expense",
            "misc_expense",
            "general_expense",
            "cost_of_goods_sold",
          ]),
        ),
      );

    const [incomeRow] = await db
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
      );

    const [expenseRow] = await db
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
      );

    const [operationalPaymentsRow] = await db
      .select({
        sum: sql<number>`coalesce(sum(${projectPayments.amount}::numeric), 0)`.as("sum"),
      })
      .from(projectPayments)
      .where(
        and(
          gte(projectPayments.paymentDate, monthStart),
          lte(projectPayments.paymentDate, monthEnd),
        ),
      );

    const [operationalCostsRow] = await db
      .select({
        sum: sql<number>`coalesce(sum(${projectCosts.amount}::numeric), 0)`.as("sum"),
      })
      .from(projectCosts)
      .where(
        and(gte(projectCosts.incurredDate, monthStart), lte(projectCosts.incurredDate, monthEnd)),
      );

    const [completedProjectsRow] = await db
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
      );

    const totalIncome = Math.round(incomeRow?.sum ?? 0);
    const totalExpense = Math.round(expenseRow?.sum ?? 0);
    const postedPaymentsSum = Math.round(paymentsPostedRow?.sum ?? 0);
    const postedCostsSum = Math.round(costsPostedRow?.sum ?? 0);
    const operationalPayments = Math.round(operationalPaymentsRow?.sum ?? 0);
    const operationalCosts = Math.round(operationalCostsRow?.sum ?? 0);
    const projectCount = completedProjectsRow?.count ?? 0;

    const incomeMatch = postedPaymentsSum === operationalPayments;
    const expenseMatch = postedCostsSum === operationalCosts;

    const checks: CloseCheckItem[] = [
      {
        id: "payments-posted",
        label: "All project payments posted",
        description: "Journal income matches operational payment totals",
        status: incomeMatch ? "pass" : "fail",
        detail: incomeMatch
          ? `Journal: ${postedPaymentsSum.toLocaleString()} = Payments: ${operationalPayments.toLocaleString()}`
          : `Journal: ${postedPaymentsSum.toLocaleString()} ≠ Payments: ${operationalPayments.toLocaleString()}`,
      },
      {
        id: "costs-posted",
        label: "All project costs posted",
        description: "Journal expense matches operational cost totals",
        status: expenseMatch ? "pass" : "fail",
        detail: expenseMatch
          ? `Journal: ${postedCostsSum.toLocaleString()} = Costs: ${operationalCosts.toLocaleString()}`
          : `Journal: ${postedCostsSum.toLocaleString()} ≠ Costs: ${operationalCosts.toLocaleString()}`,
      },
      {
        id: "no-reversed-entries",
        label: "No unreversed adjustments",
        description: "All manual adjustments have been reviewed",
        status: "warning",
        detail: "Manual review required - check ledger for unreversed entries",
      },
      {
        id: "close-snapshot",
        label: "Close snapshot generated",
        description: "Month-end snapshot has been recorded",
        status: "warning",
        detail: "Snapshot generation pending",
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
      paymentCount: operationalPaymentsRow ? 1 : 0,
      costCount: operationalCostsRow ? 1 : 0,
    });
  } catch (error) {
    return handleActionError(
      error,
      "getMonthEndCloseReport",
      "Failed to fetch month-end close report",
    );
  }
}
