"use server";

import { startOfMonth } from "date-fns";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/validate";
import { db } from "@/lib/db";
import {
  journalEntries,
  journalLines,
  ledgerAccounts,
  type PaymentMethod,
  type ProjectPayment,
  paymentMethods,
  projectPayments,
  projects,
} from "@/lib/db/schema";
import {
  assertFinanceSsotDrift,
  createBalancedJournalEntry,
  mapPaymentMethodNameToAssetAccount,
} from "@/lib/finance/ledger";
import { type ActionResponse, successResponse } from "@/lib/utils/action-response";
import { handleActionError, handleNotFoundError, handleStateError } from "@/lib/utils/error";
import { recordPaymentSchema } from "@/lib/validators/payment";

export async function recordPayment(raw: unknown): Promise<ActionResponse<ProjectPayment>> {
  try {
    const auth = await requireAuth();
    assertFinanceSsotDrift();
    const data = recordPaymentSchema.parse(raw);

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, data.projectId),
    });
    if (!project) return handleNotFoundError("Project", data.projectId);

    const method = await db.query.paymentMethods.findFirst({
      where: eq(paymentMethods.id, data.paymentMethodId),
    });
    if (!method) return handleNotFoundError("Payment method", data.paymentMethodId);

    const assetAccount = mapPaymentMethodNameToAssetAccount(method.name);
    if (!assetAccount) {
      return handleStateError(`Unsupported payment method '${method.name}' for ledger mapping.`);
    }

    const payment = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(projectPayments)
        .values({
          projectId: data.projectId,
          amount: String(Math.round(data.amount)),
          paymentMethodId: data.paymentMethodId,
          paymentDate: data.paymentDate,
          reference: data.reference ?? null,
          notes:
            data.notes && data.notes.trim().length > 0
              ? `[${data.paymentType}] ${data.notes.trim()}`
              : `[${data.paymentType}]`,
          createdBy: auth.userId,
        })
        .returning();

      if (!created) {
        throw new Error("payment_insert_failed");
      }

      await createBalancedJournalEntry({
        tx,
        entryDate: data.paymentDate,
        memo: data.notes ?? `Project payment received via ${method.name}`,
        sourceType: "project_payment",
        sourceId: created.id,
        projectId: data.projectId,
        createdBy: auth.userId,
        lines: [
          {
            accountCode: assetAccount,
            debit: Math.round(data.amount),
            credit: 0,
          },
          {
            accountCode: "accounts_receivable",
            debit: 0,
            credit: Math.round(data.amount),
          },
        ],
      });

      return created;
    });

    revalidatePath(`/projects/${data.projectId}`);
    revalidatePath("/projects");

    return successResponse(payment);
  } catch (error) {
    return handleActionError(error, "recordPayment", "Failed to record payment");
  }
}

export async function getProjectPayments(
  projectId: string,
): Promise<ActionResponse<(ProjectPayment & { paymentMethodName: string })[]>> {
  try {
    await requireAuth();
    const rows = await db
      .select({
        payment: projectPayments,
        methodName: paymentMethods.name,
      })
      .from(projectPayments)
      .innerJoin(paymentMethods, eq(projectPayments.paymentMethodId, paymentMethods.id))
      .where(eq(projectPayments.projectId, projectId))
      .orderBy(desc(projectPayments.paymentDate));

    return successResponse(
      rows.map((r) => ({
        ...r.payment,
        paymentMethodName: r.methodName,
      })),
    );
  } catch (error) {
    return handleActionError(error, "getProjectPayments", "Failed to fetch payments");
  }
}

export async function getPaymentMethods(): Promise<ActionResponse<PaymentMethod[]>> {
  try {
    await requireAuth();
    const methods = await db.query.paymentMethods.findMany({
      where: eq(paymentMethods.isActive, true),
      orderBy: [desc(paymentMethods.createdAt)],
    });
    return successResponse(methods);
  } catch (error) {
    return handleActionError(error, "getPaymentMethods", "Failed to fetch payment methods");
  }
}

interface MonthlyFinanceRow {
  month: string;
  incoming: number;
  outgoing: number;
  net: number;
}

export async function getFinanceSummary(): Promise<
  ActionResponse<{
    monthly: MonthlyFinanceRow[];
    totalIncoming: number;
    totalOutgoing: number;
    unpaidCompleted: number;
  }>
> {
  try {
    await requireAuth();

    const sixMonthsAgo = startOfMonth(new Date());
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);

    const journalRows = await db
      .select({
        entryDate: journalEntries.entryDate,
        sourceType: journalEntries.sourceType,
        debit: sql<string>`coalesce(sum(${journalLines.debit}::numeric), 0)`.as("debit"),
        credit: sql<string>`coalesce(sum(${journalLines.credit}::numeric), 0)`.as("credit"),
      })
      .from(journalEntries)
      .innerJoin(journalLines, eq(journalLines.entryId, journalEntries.id))
      .innerJoin(ledgerAccounts, eq(journalLines.accountId, ledgerAccounts.id))
      .where(
        and(
          gte(journalEntries.entryDate, sixMonthsAgo),
          inArray(journalEntries.sourceType, ["project_payment", "project_expense"]),
          eq(journalEntries.isReversed, false),
        ),
      )
      .groupBy(journalEntries.id, journalEntries.entryDate, journalEntries.sourceType)
      .orderBy(desc(journalEntries.entryDate));

    const monthlyMap = new Map<string, { incoming: number; outgoing: number }>();

    for (const row of journalRows) {
      const m = formatMonthKey(row.entryDate);
      const entry = monthlyMap.get(m) ?? { incoming: 0, outgoing: 0 };
      if (row.sourceType === "project_payment") {
        entry.incoming += Math.round(Number(row.debit));
      } else if (row.sourceType === "project_expense") {
        entry.outgoing += Math.round(Number(row.debit));
      }
      monthlyMap.set(m, entry);
    }

    const monthly: MonthlyFinanceRow[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = formatMonthKey(d);
      const entry = monthlyMap.get(key) ?? { incoming: 0, outgoing: 0 };
      monthly.push({
        month: key,
        incoming: entry.incoming,
        outgoing: entry.outgoing,
        net: entry.incoming - entry.outgoing,
      });
    }

    const [totalIncomingRow] = await db
      .select({
        sum: sql<number>`coalesce(sum(${journalLines.debit}::numeric), 0)`.as("sum"),
      })
      .from(journalEntries)
      .innerJoin(journalLines, eq(journalLines.entryId, journalEntries.id))
      .where(
        and(eq(journalEntries.sourceType, "project_payment"), eq(journalEntries.isReversed, false)),
      );

    const [totalOutgoingRow] = await db
      .select({
        sum: sql<number>`coalesce(sum(${journalLines.debit}::numeric), 0)`.as("sum"),
      })
      .from(journalEntries)
      .innerJoin(journalLines, eq(journalLines.entryId, journalEntries.id))
      .where(
        and(eq(journalEntries.sourceType, "project_expense"), eq(journalEntries.isReversed, false)),
      );

    const unpaidCompletedRows = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(projects)
      .where(
        and(
          eq(projects.status, "completed"),
          sql`cast(${projects.quotedTotal} as numeric) > coalesce((
            select sum(cast(${projectPayments.amount} as numeric))
            from ${projectPayments}
            where ${projectPayments.projectId} = ${projects.id}
          ), 0)`,
        ),
      );

    return successResponse({
      monthly,
      totalIncoming: Math.round(totalIncomingRow?.sum ?? 0),
      totalOutgoing: Math.round(totalOutgoingRow?.sum ?? 0),
      unpaidCompleted: unpaidCompletedRows[0]?.count ?? 0,
    });
  } catch (error) {
    return handleActionError(error, "getFinanceSummary", "Failed to fetch finance summary");
  }
}

function formatMonthKey(date: Date | string): string {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
