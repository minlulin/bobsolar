"use server";

import { startOfMonth } from "date-fns";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/validate";
import { db } from "@/lib/db";
import {
  type PaymentMethod,
  type ProjectPayment,
  paymentMethods,
  projectCosts,
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
          notes: data.notes ?? null,
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

    const payments = await db
      .select({
        amount: projectPayments.amount,
        paymentDate: projectPayments.paymentDate,
      })
      .from(projectPayments)
      .where(gte(projectPayments.paymentDate, sixMonthsAgo))
      .orderBy(desc(projectPayments.paymentDate));

    const costs = await db
      .select({
        amount: sql<string>`coalesce(sum(${projectCosts.amount}::numeric), 0)`.as("amount"),
        month: sql<string>`date_trunc('month', incurred_date)::date`.as("month"),
      })
      .from(projectCosts)
      .where(gte(projectCosts.incurredDate, sixMonthsAgo))
      .groupBy(sql`date_trunc('month', incurred_date)`);

    const monthlyMap = new Map<string, { incoming: number; outgoing: number }>();

    for (const p of payments) {
      const m = formatMonthKey(p.paymentDate);
      const entry = monthlyMap.get(m) ?? { incoming: 0, outgoing: 0 };
      entry.incoming += Math.round(Number(p.amount));
      monthlyMap.set(m, entry);
    }

    for (const c of costs) {
      const m = formatMonthKey(c.month);
      const entry = monthlyMap.get(m) ?? { incoming: 0, outgoing: 0 };
      entry.outgoing += Math.round(Number(c.amount));
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

    const [totalPayments] = await db
      .select({
        sum: sql<number>`coalesce(sum(${projectPayments.amount}::numeric), 0)`.as("sum"),
      })
      .from(projectPayments);

    const [totalCosts] = await db
      .select({
        sum: sql<number>`coalesce(sum(${projectCosts.amount}::numeric), 0)`.as("sum"),
      })
      .from(projectCosts);

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
      totalIncoming: Math.round(totalPayments?.sum ?? 0),
      totalOutgoing: Math.round(totalCosts?.sum ?? 0),
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
