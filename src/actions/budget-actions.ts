"use server";

import { and, eq, gte, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { requireOwner } from "@/lib/auth/validate";
import { db } from "@/lib/db";
import {
  type Budget,
  budgets,
  journalEntries,
  journalLines,
  ledgerAccounts,
} from "@/lib/db/schema";
import { LEDGER_ACCOUNT_LABELS, type LedgerAccountCode } from "@/lib/domain/finance";
import { type ActionResponse, errorResponse, successResponse } from "@/lib/utils/action-response";
import { handleActionError } from "@/lib/utils/error";
import { uuidSchema } from "@/lib/validators/common";

const createBudgetSchema = z.object({
  accountCode: z.string().min(1, "Account code is required"),
  periodStart: z.string().min(1, "Period start is required"),
  periodEnd: z.string().min(1, "Period end is required"),
  budgetAmount: z.number().min(0, "Budget amount must be non-negative"),
  notes: z.string().max(500).optional().nullable(),
});

const budgetFilterSchema = z.object({
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
});

export interface BudgetWithVariance {
  id: string;
  accountCode: string;
  accountLabel: string;
  periodStart: string;
  periodEnd: string;
  budgetAmount: number;
  actualAmount: number;
  variance: number;
  variancePercent: number;
  status: "under_budget" | "near_limit" | "over_budget" | "no_budget";
  notes: string | null;
}

export interface BudgetReport {
  periodStart: string;
  periodEnd: string;
  accounts: BudgetWithVariance[];
  totalBudget: number;
  totalActual: number;
  totalVariance: number;
}

export async function getBudgetReport(
  rawFilters: unknown = {},
): Promise<ActionResponse<BudgetReport>> {
  try {
    await requireOwner();

    const filters = budgetFilterSchema.parse(rawFilters);
    const now = new Date();
    const periodStart = filters.periodStart ?? `${now.getFullYear()}-01-01`;
    const periodEnd = filters.periodEnd ?? `${now.getFullYear()}-12-31`;

    const startDate = new Date(periodStart);
    const endDate = new Date(periodEnd);
    endDate.setHours(23, 59, 59, 999);

    // Fetch budgets for the period
    const budgetRows = await db
      .select()
      .from(budgets)
      .where(and(lte(budgets.periodStart, periodEnd), gte(budgets.periodEnd, periodStart)));

    // Fetch actual expenses per account for the period
    const actualRows = await db
      .select({
        accountCode: ledgerAccounts.code,
        actualAmount:
          sql<number>`coalesce(sum(${journalLines.debit}::numeric - ${journalLines.credit}::numeric), 0)`.as(
            "actual_amount",
          ),
      })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .innerJoin(ledgerAccounts, eq(journalLines.accountId, ledgerAccounts.id))
      .where(
        and(
          gte(journalEntries.entryDate, startDate),
          lte(journalEntries.entryDate, endDate),
          eq(journalEntries.isReversed, false),
          eq(ledgerAccounts.type, "expense"),
        ),
      )
      .groupBy(ledgerAccounts.code);

    const actualMap = new Map<string, number>();
    for (const row of actualRows) {
      actualMap.set(row.accountCode, Math.round(row.actualAmount));
    }

    // Build report
    const accountMap = new Map<string, BudgetWithVariance>();
    let totalBudget = 0;
    let totalActual = 0;

    for (const budget of budgetRows) {
      const budgetAmt = Math.round(Number(budget.budgetAmount));
      const actualAmt = actualMap.get(budget.accountCode) ?? 0;
      const variance = actualAmt - budgetAmt;
      const variancePercent = budgetAmt > 0 ? Math.round((variance / budgetAmt) * 100) : 0;

      let status: BudgetWithVariance["status"] = "under_budget";
      if (variancePercent > 100) status = "over_budget";
      else if (variancePercent > 80) status = "near_limit";

      totalBudget += budgetAmt;
      totalActual += actualAmt;

      accountMap.set(budget.accountCode, {
        id: budget.id,
        accountCode: budget.accountCode,
        accountLabel:
          LEDGER_ACCOUNT_LABELS[budget.accountCode as LedgerAccountCode] ?? budget.accountCode,
        periodStart: budget.periodStart,
        periodEnd: budget.periodEnd,
        budgetAmount: budgetAmt,
        actualAmount: actualAmt,
        variance,
        variancePercent,
        status,
        notes: budget.notes,
      });
    }

    // Add accounts with actuals but no budget
    for (const [code, actual] of actualMap) {
      if (!accountMap.has(code)) {
        accountMap.set(code, {
          id: "",
          accountCode: code,
          accountLabel: LEDGER_ACCOUNT_LABELS[code as LedgerAccountCode] ?? code,
          periodStart,
          periodEnd,
          budgetAmount: 0,
          actualAmount: actual,
          variance: actual,
          variancePercent: 0,
          status: "no_budget",
          notes: null,
        });
        totalActual += actual;
      }
    }

    const accounts = Array.from(accountMap.values()).sort(
      (a, b) => b.variancePercent - a.variancePercent,
    );

    return successResponse({
      periodStart,
      periodEnd,
      accounts,
      totalBudget,
      totalActual,
      totalVariance: totalActual - totalBudget,
    });
  } catch (error) {
    return handleActionError(error, "getBudgetReport", "Failed to fetch budget report");
  }
}

export async function createBudget(raw: unknown): Promise<ActionResponse<Budget>> {
  try {
    const auth = await requireOwner();
    const data = createBudgetSchema.parse(raw);

    const [account] = await db
      .select({ code: ledgerAccounts.code })
      .from(ledgerAccounts)
      .where(eq(ledgerAccounts.code, data.accountCode))
      .limit(1);

    if (!account) {
      return errorResponse("Budget account does not exist.");
    }

    const [existingBudget] = await db
      .select({ id: budgets.id })
      .from(budgets)
      .where(
        and(
          eq(budgets.accountCode, data.accountCode),
          eq(budgets.periodStart, data.periodStart),
          eq(budgets.periodEnd, data.periodEnd),
        ),
      )
      .limit(1);

    if (existingBudget) {
      return errorResponse("A budget already exists for this account and period.");
    }

    const [created] = await db
      .insert(budgets)
      .values({
        accountCode: data.accountCode,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        budgetAmount: String(data.budgetAmount),
        notes: data.notes ?? null,
        createdBy: auth.userId,
      })
      .returning();

    if (!created) return errorResponse("Failed to create budget");
    return successResponse(created);
  } catch (error) {
    return handleActionError(error, "createBudget", "Failed to create budget");
  }
}

export async function updateBudget(id: string, raw: unknown): Promise<ActionResponse<Budget>> {
  try {
    await requireOwner();
    const validatedId = uuidSchema.parse(id);
    const data = createBudgetSchema.parse(raw);

    const [updated] = await db
      .update(budgets)
      .set({
        accountCode: data.accountCode,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        budgetAmount: String(data.budgetAmount),
        notes: data.notes ?? null,
        updatedAt: new Date(),
      })
      .where(eq(budgets.id, validatedId))
      .returning();

    if (!updated) return errorResponse("Budget not found");
    return successResponse(updated);
  } catch (error) {
    return handleActionError(error, "updateBudget", "Failed to update budget");
  }
}

export async function deleteBudget(id: string): Promise<ActionResponse<null>> {
  try {
    await requireOwner();
    const validatedId = uuidSchema.parse(id);

    await db.delete(budgets).where(eq(budgets.id, validatedId));
    return successResponse(null);
  } catch (error) {
    return handleActionError(error, "deleteBudget", "Failed to delete budget");
  }
}
