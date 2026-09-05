"use server";

import { startOfMonth, subMonths } from "date-fns";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { requireOwner } from "@/lib/auth/validate";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import {
  journalEntries,
  journalLines,
  ledgerAccounts,
  type PaymentMethod,
  type ProjectPayment,
  paymentMethods,
  projectInvoices,
  projectPaymentAllocations,
  projectPayments,
  projects,
} from "@/lib/db/schema";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_PRESETS,
  type PaymentMethodPreset,
} from "@/lib/domain/payment";
import { invalidateFinanceCacheForWrite } from "@/lib/finance/cache-invalidation";
import {
  assertFinanceSsotDrift,
  createBalancedJournalEntry,
  mapPaymentMethodNameToAssetAccount,
} from "@/lib/finance/ledger";
import { type ActionResponse, successResponse } from "@/lib/utils/action-response";
import { handleActionError, handleNotFoundError, handleStateError } from "@/lib/utils/error";
import { toDbDecimal, uuidSchema } from "@/lib/validators/common";
import { recordPaymentSchema } from "@/lib/validators/payment";

export async function recordPayment(raw: unknown): Promise<ActionResponse<ProjectPayment>> {
  try {
    const auth = await requireOwner();
    assertFinanceSsotDrift();
    const data = recordPaymentSchema.parse(raw);

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, data.projectId),
    });
    if (!project) return handleNotFoundError("Project", data.projectId);

    // Enforce project status rules for payments.
    // Final payments require a completed project; advances require an active project.
    if (data.paymentType === "final") {
      if (project.status !== "completed") {
        return handleStateError(
          `Final payments can only be recorded on completed projects. Current status: ${project.status}.`,
        );
      }
    } else {
      // advance
      const allowedStatuses = ["in_progress", "on_hold", "installation_completed", "completed"];
      if (!allowedStatuses.includes(project.status)) {
        return handleStateError(
          `Advance payments cannot be recorded on projects with status '${project.status}'.`,
        );
      }
    }

    const method = await db.query.paymentMethods.findFirst({
      where: eq(paymentMethods.id, data.paymentMethodId),
    });
    if (!method) return handleNotFoundError("Payment method", data.paymentMethodId);

    const assetAccount = mapPaymentMethodNameToAssetAccount(method.name);
    if (!assetAccount) {
      return handleStateError(`Unsupported payment method '${method.name}' for ledger mapping.`);
    }

    const payment = await db.transaction(async (tx) => {
      // Idempotency check: prevent duplicate payments with the same project, method, date, and reference.
      // NOTE: For advance payments without a reference (reference = null), two same-day payments
      // from the same method cannot be distinguished by key alone. We MUST reject the second one
      // explicitly — silently returning the old record would mean money received but not recorded.
      const reference = data.reference ?? null;
      const existingPayment = await tx.query.projectPayments.findFirst({
        where: and(
          eq(projectPayments.projectId, data.projectId),
          eq(projectPayments.paymentMethodId, data.paymentMethodId),
          eq(projectPayments.paymentDate, data.paymentDate),
          reference
            ? eq(projectPayments.reference, reference)
            : sql`${projectPayments.reference} IS NULL`,
        ),
      });
      if (existingPayment) {
        // A payment with identical key fields already exists.
        // Throw so the caller gets a clear duplicate error rather than a silent no-op.
        throw new Error("duplicate_payment");
      }

      const [arRow] = await tx
        .select({
          balance:
            sql<number>`coalesce(sum(${journalLines.debit}::numeric) - sum(${journalLines.credit}::numeric), 0)`.as(
              "balance",
            ),
        })
        .from(journalLines)
        .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
        .innerJoin(ledgerAccounts, eq(journalLines.accountId, ledgerAccounts.id))
        .where(
          and(
            eq(journalLines.projectId, data.projectId),
            eq(ledgerAccounts.code, "accounts_receivable"),
            eq(journalEntries.isReversed, false),
          ),
        );
      const openAr = Math.round(Number(arRow?.balance ?? 0));

      if (data.paymentType === "final" && Math.round(data.amount) > openAr) {
        throw new Error("payment_exceeds_ar");
      }

      const creditAccount =
        data.paymentType === "advance" ? "customer_deposits" : "accounts_receivable";

      const [created] = await tx
        .insert(projectPayments)
        .values({
          projectId: data.projectId,
          amount: toDbDecimal(Math.round(data.amount)),
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

      if (data.paymentType === "advance" && project.depositRequired) {
        await tx
          .update(projects)
          .set({ depositReceived: true, updatedAt: new Date() })
          .where(eq(projects.id, project.id));
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
            accountCode: creditAccount,
            debit: 0,
            credit: Math.round(data.amount),
          },
        ],
      });

      if (data.allocations && data.allocations.length > 0) {
        let totalAllocated = 0;
        for (const alloc of data.allocations) {
          totalAllocated += alloc.amount;
        }
        if (Math.round(totalAllocated) > Math.round(data.amount)) {
          throw new Error("allocation_exceeds_payment");
        }

        for (const alloc of data.allocations) {
          // Lock the invoice row before read-modify-write to prevent concurrent
          // allocation races that would corrupt paidAmount / balanceDue.
          const [invoice] = await tx
            .select()
            .from(projectInvoices)
            .where(
              and(
                eq(projectInvoices.id, alloc.invoiceId),
                eq(projectInvoices.projectId, data.projectId),
              ),
            )
            .for("update");
          if (!invoice) {
            throw new Error("invoice_not_found_or_mismatched_project");
          }

          const currentBalanceDue = Math.round(Number(invoice.balanceDue));
          if (Math.round(alloc.amount) > currentBalanceDue) {
            throw new Error("allocation_exceeds_invoice_balance");
          }

          await tx.insert(projectPaymentAllocations).values({
            paymentId: created.id,
            invoiceId: alloc.invoiceId,
            amount: String(alloc.amount),
          });

          const newPaidAmount = Math.round(Number(invoice.paidAmount)) + Math.round(alloc.amount);
          const newBalanceDue = Math.round(Number(invoice.total)) - newPaidAmount;
          const newStatus = newBalanceDue <= 0 ? "paid" : "partial";

          await tx
            .update(projectInvoices)
            .set({
              paidAmount: String(newPaidAmount),
              balanceDue: String(Math.max(0, newBalanceDue)),
              status: newStatus,
              updatedAt: new Date(),
            })
            .where(eq(projectInvoices.id, invoice.id));
        }
      }

      return created;
    });

    revalidatePath(`/projects/${data.projectId}`);
    revalidatePath("/projects");
    // Payment allocations mutate invoice paidAmount/balanceDue/status — the
    // invoices hub must reflect the new balances immediately.
    revalidatePath("/invoices");
    revalidateTag(CACHE_TAGS.INVOICES_LIST, "max");
    await invalidateFinanceCacheForWrite();

    return successResponse(payment);
  } catch (error) {
    if (error instanceof Error && error.message === "payment_exceeds_ar") {
      return handleStateError("Payment amount cannot exceed open accounts receivable balance.");
    }
    if (error instanceof Error && error.message === "allocation_exceeds_payment") {
      return handleStateError("Allocations cannot exceed the total payment amount.");
    }
    // C-1: Explicit error for duplicate advance payments (same project/method/date/null-reference).
    // Caller must supply a unique reference field to distinguish same-day advance payments.
    if (error instanceof Error && error.message === "duplicate_payment") {
      return handleStateError(
        "A payment with the same date, method, and reference already exists for this project. " +
          "Please add a unique reference number to distinguish this payment.",
      );
    }
    if (error instanceof Error && error.message === "invoice_not_found_or_mismatched_project") {
      return handleStateError(
        "One or more allocated invoices were not found or do not belong to this project.",
      );
    }
    if (error instanceof Error && error.message === "allocation_exceeds_invoice_balance") {
      return handleStateError(
        "An allocation amount exceeds the remaining balance due on one of the invoices.",
      );
    }
    return handleActionError(error, "recordPayment", "Failed to record payment");
  }
}

export async function getProjectPayments(
  projectId: string,
): Promise<ActionResponse<(ProjectPayment & { paymentMethodName: string })[]>> {
  try {
    await requireOwner();
    const validatedProjectId = uuidSchema.parse(projectId);
    const rows = await db
      .select({
        payment: projectPayments,
        methodName: paymentMethods.name,
      })
      .from(projectPayments)
      .innerJoin(paymentMethods, eq(projectPayments.paymentMethodId, paymentMethods.id))
      .where(eq(projectPayments.projectId, validatedProjectId))
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
    await requireOwner();
    const methods = await db.query.paymentMethods.findMany({
      where: eq(paymentMethods.isActive, true),
      orderBy: [desc(paymentMethods.createdAt)],
    });

    // Do not throw an error if an unsupported method exists, just filter them out
    // or return them all. Returning them all is safer, ledger mapping will handle errors
    // at payment time if needed, but the dropdown should render.
    // We'll filter to known labels or presets to be safe, but NOT throw an error.
    const knownLabels = new Set([
      ...Object.values(PAYMENT_METHOD_LABELS),
      ...PAYMENT_METHOD_PRESETS,
    ]);
    const validMethods = methods.filter(
      (method) => knownLabels.has(method.name) || mapPaymentMethodNameToAssetAccount(method.name),
    );

    // Map them to ensure they have pretty labels if they were saved as presets
    const mappedMethods = validMethods.map((m) => ({
      ...m,
      name: PAYMENT_METHOD_LABELS[m.name as PaymentMethodPreset] || m.name,
    }));

    return successResponse(mappedMethods);
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

export async function getPaymentFinanceSummary(): Promise<
  ActionResponse<{
    monthly: MonthlyFinanceRow[];
    totalIncoming: number;
    totalOutgoing: number;
    unpaidCompleted: number;
  }>
> {
  try {
    await requireOwner();

    const sixMonthWindowStart = startOfMonth(subMonths(new Date(), 5));

    const monthlyMap = new Map<string, { incoming: number; outgoing: number }>();

    const [journalRows, [totalIncomingRow], [totalOutgoingRow], unpaidCompletedRows] =
      await Promise.all([
        db
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
              gte(journalEntries.entryDate, sixMonthWindowStart),
              inArray(journalEntries.sourceType, ["project_payment", "project_expense"]),
              eq(journalEntries.isReversed, false),
            ),
          )
          .groupBy(journalEntries.id, journalEntries.entryDate, journalEntries.sourceType)
          .orderBy(desc(journalEntries.entryDate)),
        db
          .select({
            sum: sql<number>`coalesce(sum(${journalLines.debit}::numeric), 0)`.as("sum"),
          })
          .from(journalEntries)
          .innerJoin(journalLines, eq(journalLines.entryId, journalEntries.id))
          .where(
            and(
              eq(journalEntries.sourceType, "project_payment"),
              eq(journalEntries.isReversed, false),
            ),
          ),
        db
          .select({
            sum: sql<number>`coalesce(sum(${journalLines.debit}::numeric), 0)`.as("sum"),
          })
          .from(journalEntries)
          .innerJoin(journalLines, eq(journalLines.entryId, journalEntries.id))
          .where(
            and(
              eq(journalEntries.sourceType, "project_expense"),
              eq(journalEntries.isReversed, false),
            ),
          ),
        db
          .select({ count: sql<number>`cast(count(*) as int)` })
          .from(projects)
          .where(
            and(
              eq(projects.status, "completed"),
              sql`cast(${projects.quotedTotal} as numeric) > coalesce((
              select sum(cast(pp.amount as numeric))
              from ${projectPayments} pp
              inner join ${journalEntries} je
                on je.source_type = 'project_payment'
                and je.source_id = pp.id
                and je.is_reversed = false
              where pp.project_id = ${projects.id}
            ), 0)`,
            ),
          ),
      ]);

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
      const key = formatMonthKey(subMonths(new Date(), i));
      const entry = monthlyMap.get(key) ?? { incoming: 0, outgoing: 0 };
      monthly.push({
        month: key,
        incoming: entry.incoming,
        outgoing: entry.outgoing,
        net: entry.incoming - entry.outgoing,
      });
    }

    return successResponse({
      monthly,
      totalIncoming: Math.round(totalIncomingRow?.sum ?? 0),
      totalOutgoing: Math.round(totalOutgoingRow?.sum ?? 0),
      unpaidCompleted: unpaidCompletedRows[0]?.count ?? 0,
    });
  } catch (error) {
    return handleActionError(error, "getPaymentFinanceSummary", "Failed to fetch finance summary");
  }
}

function formatMonthKey(date: Date | string): string {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
