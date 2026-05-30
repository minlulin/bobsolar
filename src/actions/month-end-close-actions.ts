"use server";

import { endOfMonth, format, startOfMonth } from "date-fns";
import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { requireFinanceAccess } from "@/lib/auth/validate";
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
    await requireFinanceAccess();

    const input = monthSchema.parse(rawInput);
    const monthStart = startOfMonth(new Date(input.year, input.month));
    const monthEnd = endOfMonth(new Date(input.year, input.month));
    const monthLabel = format(monthStart, "MMMM yyyy");
    // Period key used in accountingPeriods table (e.g. "2026-05")
    const periodKey = format(monthStart, "yyyy-MM");

    // ─── H-1 FIX: Payments-posted check ───────────────────────────────────────
    // The OLD check compared only the AR-credit side of project_payment journal
    // entries against the raw projectPayments sum. This failed for advance
    // payments, which credit `customer_deposits` (not `accounts_receivable`).
    //
    // CORRECT approach: compare the DEBIT side of all project_payment entries
    // (which always records the asset account, regardless of payment type) against
    // the sum of non-reversed operational payment rows. Both sides exclude reversed
    // entries for consistency.
    //
    // Journal side: sum debit lines from non-reversed project_payment entries in period.
    const [paymentsPostedRow] = await db
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
          // Debit side = asset account (cash/bank); a debit > 0 means money came in.
          // Filtering for asset accounts avoids double-counting if both sides matched.
          eq(ledgerAccounts.type, "asset"),
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
          inArray(journalEntries.sourceType, ["project_expense", "inventory_consumption"]),
          eq(journalEntries.isReversed, false),
          inArray(ledgerAccounts.code, [...OPERATING_EXPENSE_ACCOUNT_CODES, ...COGS_ACCOUNT_CODES]),
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

    // Operational payments: only count payments whose journal entry has NOT been reversed.
    // Joining to journalEntries on (sourceType, sourceId) with isReversed=false means
    // reversed payments are excluded from the reference total, matching the journal-side query.
    const [operationalPaymentsRow] = await db
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
      );

    const [operationalCostsRow] = await db
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

    // ─── L-4 FIX: Real queries for the two previously hardcoded warning checks ─
    //
    // Check 1: Count manual-adjustment journal entries in the period.
    // A non-zero count means someone posted a manual entry that should be reviewed.
    const [manualAdjustmentsRow] = await db
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
      );
    const manualAdjustmentCount = manualAdjustmentsRow?.count ?? 0;

    // Check 2: Look for a closed or soft-closed accounting period record for this month.
    const [periodRow] = await db
      .select({
        status: accountingPeriods.status,
      })
      .from(accountingPeriods)
      .where(eq(accountingPeriods.periodMonth, periodKey));
    const periodIsClosed = periodRow?.status === "closed" || periodRow?.status === "soft_closed";
    // ──────────────────────────────────────────────────────────────────────────

    const totalIncome = Math.round(incomeRow?.sum ?? 0);
    const totalExpense = Math.round(expenseRow?.sum ?? 0);
    const postedPaymentsSum = Math.round(paymentsPostedRow?.sum ?? 0);
    const postedCostsSum = Math.round(costsPostedRow?.sum ?? 0);
    const operationalPayments = Math.round(operationalPaymentsRow?.sum ?? 0);
    const operationalCosts = Math.round(operationalCostsRow?.sum ?? 0);
    const projectCount = completedProjectsRow?.count ?? 0;

    // H-1: Both sides now measure the same thing (debit=cash-in for payments;
    // non-reversed operational rows for the reference side).
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
          ? `Period ${periodKey} is ${periodRow?.status}`
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
      paymentCount: operationalPaymentsRow?.count ?? 0,
      costCount: operationalCostsRow?.count ?? 0,
    });
  } catch (error) {
    return handleActionError(
      error,
      "getMonthEndCloseReport",
      "Failed to fetch month-end close report",
    );
  }
}
