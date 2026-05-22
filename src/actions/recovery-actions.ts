"use server";

import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/validate";
import { db } from "@/lib/db";
import { journalEntries, paymentMethods, projectCosts, projectPayments } from "@/lib/db/schema";
import type { LedgerAccountCode } from "@/lib/domain/enums";
import { createBalancedJournalEntry } from "@/lib/finance/ledger";
import { type ActionResponse, successResponse } from "@/lib/utils/action-response";
import { handleActionError } from "@/lib/utils/error";

export interface OrphanPaymentRecord {
  paymentId: string;
  projectId: string;
  amount: number;
  paymentDate: Date;
  hasJournalEntry: boolean;
}

export interface OrphanCostRecord {
  costId: string;
  projectId: string;
  amount: number;
  incurredDate: Date;
  costType: string;
  hasJournalEntry: boolean;
}

export interface RecoveryReport {
  orphanPayments: OrphanPaymentRecord[];
  orphanCosts: OrphanCostRecord[];
  totalOrphanPayments: number;
  totalOrphanCosts: number;
}

export async function getRecoveryReport(): Promise<ActionResponse<RecoveryReport>> {
  try {
    await requireAdmin();

    const payments = await db
      .select({
        id: projectPayments.id,
        projectId: projectPayments.projectId,
        amount: projectPayments.amount,
        paymentDate: projectPayments.paymentDate,
      })
      .from(projectPayments)
      .orderBy(projectPayments.paymentDate);

    const costs = await db
      .select({
        id: projectCosts.id,
        projectId: projectCosts.projectId,
        amount: projectCosts.amount,
        incurredDate: projectCosts.incurredDate,
        costType: projectCosts.costType,
      })
      .from(projectCosts)
      .orderBy(projectCosts.incurredDate);

    const paymentIds = payments.map((p) => p.id);
    const costIds = costs.map((c) => c.id);

    const paymentJournalEntries =
      paymentIds.length > 0
        ? await db
            .select({ sourceId: journalEntries.sourceId })
            .from(journalEntries)
            .where(eq(journalEntries.sourceType, "project_payment"))
        : [];

    const costJournalEntries =
      costIds.length > 0
        ? await db
            .select({ sourceId: journalEntries.sourceId })
            .from(journalEntries)
            .where(eq(journalEntries.sourceType, "project_expense"))
        : [];

    const paymentJournalIds = new Set(paymentJournalEntries.map((e) => e.sourceId));
    const costJournalIds = new Set(costJournalEntries.map((e) => e.sourceId));

    const orphanPayments: OrphanPaymentRecord[] = payments
      .filter((p) => !paymentJournalIds.has(p.id))
      .map((p) => ({
        paymentId: p.id,
        projectId: p.projectId,
        amount: Math.round(Number(p.amount)),
        paymentDate: p.paymentDate,
        hasJournalEntry: false,
      }));

    const orphanCosts: OrphanCostRecord[] = costs
      .filter((c) => !costJournalIds.has(c.id))
      .map((c) => ({
        costId: c.id,
        projectId: c.projectId,
        amount: Math.round(Number(c.amount)),
        incurredDate: c.incurredDate,
        costType: c.costType,
        hasJournalEntry: false,
      }));

    return successResponse({
      orphanPayments,
      orphanCosts,
      totalOrphanPayments: orphanPayments.length,
      totalOrphanCosts: orphanCosts.length,
    });
  } catch (error) {
    return handleActionError(error, "getRecoveryReport", "Failed to fetch recovery report");
  }
}

export async function repairOrphanPayment(
  paymentId: string,
): Promise<ActionResponse<{ entryId: string }>> {
  try {
    const auth = await requireAdmin();

    const payment = await db.query.projectPayments.findFirst({
      where: eq(projectPayments.id, paymentId),
    });

    if (!payment) {
      return handleActionError(
        new Error("Payment not found"),
        "repairOrphanPayment",
        "Payment not found",
      );
    }

    const existingEntry = await db.query.journalEntries.findFirst({
      where: eq(journalEntries.sourceId, paymentId),
    });

    if (existingEntry) {
      return handleActionError(
        new Error("Journal entry already exists for this payment"),
        "repairOrphanPayment",
        "Journal entry already exists",
      );
    }

    const method = await db.query.paymentMethods.findFirst({
      where: eq(projectPayments.paymentMethodId, payment.paymentMethodId),
    });

    if (!method) {
      return handleActionError(
        new Error("Payment method not found"),
        "repairOrphanPayment",
        "Payment method not found",
      );
    }

    const { mapPaymentMethodNameToAssetAccount } = await import("@/lib/finance/ledger");
    const assetAccount = mapPaymentMethodNameToAssetAccount(method.name);

    if (!assetAccount) {
      return handleActionError(
        new Error(`Unsupported payment method '${method.name}'`),
        "repairOrphanPayment",
        "Unsupported payment method",
      );
    }

    const result = await db.transaction(async (tx) => {
      return createBalancedJournalEntry({
        tx,
        entryDate: payment.paymentDate,
        memo: `Repaired journal entry for payment ${paymentId.slice(0, 8)}`,
        sourceType: "project_payment",
        sourceId: payment.id,
        projectId: payment.projectId,
        createdBy: auth.userId,
        lines: [
          { accountCode: assetAccount, debit: Math.round(Number(payment.amount)), credit: 0 },
          {
            accountCode: "accounts_receivable",
            debit: 0,
            credit: Math.round(Number(payment.amount)),
          },
        ],
      });
    });

    return successResponse(result);
  } catch (error) {
    return handleActionError(error, "repairOrphanPayment", "Failed to repair orphan payment");
  }
}

export async function repairOrphanCost(
  costId: string,
): Promise<ActionResponse<{ entryId: string }>> {
  try {
    const auth = await requireAdmin();

    const cost = await db.query.projectCosts.findFirst({
      where: eq(projectCosts.id, costId),
    });

    if (!cost) {
      return handleActionError(new Error("Cost not found"), "repairOrphanCost", "Cost not found");
    }

    const existingEntry = await db.query.journalEntries.findFirst({
      where: eq(journalEntries.sourceId, costId),
    });

    if (existingEntry) {
      return handleActionError(
        new Error("Journal entry already exists for this cost"),
        "repairOrphanCost",
        "Journal entry already exists",
      );
    }

    const { mapCostTypeToExpenseAccount, mapPaymentMethodNameToAssetAccount } = await import(
      "@/lib/finance/ledger"
    );
    const expenseAccount = mapCostTypeToExpenseAccount(cost.costType);

    let creditAccount: LedgerAccountCode = "cash_on_hand";
    if (cost.costType === "material" || cost.itemId) {
      creditAccount = "raw_materials";
    } else if (cost.paymentMethodId) {
      const method = await db.query.paymentMethods.findFirst({
        where: eq(paymentMethods.id, cost.paymentMethodId),
      });
      if (method) {
        const assetAccount = mapPaymentMethodNameToAssetAccount(method.name);
        if (assetAccount) {
          creditAccount = assetAccount;
        }
      }
    }

    const result = await db.transaction(async (tx) => {
      return createBalancedJournalEntry({
        tx,
        entryDate: cost.incurredDate,
        memo: `Repaired journal entry for cost ${costId.slice(0, 8)}`,
        sourceType: "project_expense",
        sourceId: cost.id,
        projectId: cost.projectId,
        createdBy: auth.userId,
        lines: [
          { accountCode: expenseAccount, debit: Math.round(Number(cost.amount)), credit: 0 },
          { accountCode: creditAccount, debit: 0, credit: Math.round(Number(cost.amount)) },
        ],
      });
    });

    return successResponse(result);
  } catch (error) {
    return handleActionError(error, "repairOrphanCost", "Failed to repair orphan cost");
  }
}
