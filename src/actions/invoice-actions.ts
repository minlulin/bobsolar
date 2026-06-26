"use server";

import { format } from "date-fns";
import { eq } from "drizzle-orm";
import { requireOwner } from "@/lib/auth/validate";
import { db } from "@/lib/db";
import { projectInvoiceLines, projectInvoices, projects } from "@/lib/db/schema";
import { canPostInvoice } from "@/lib/domain/invoice";
import { invalidateFinanceCacheForWrite } from "@/lib/finance/cache-invalidation";
import { createBalancedJournalEntry } from "@/lib/finance/ledger";
import { type ActionResponse, successResponse } from "@/lib/utils/action-response";
import { handleActionError } from "@/lib/utils/error";
import { createInvoiceSchema, postInvoiceSchema } from "@/lib/validators/invoice";

export async function createInvoice(
  rawInput: unknown,
): Promise<ActionResponse<{ invoiceId: string }>> {
  try {
    const session = await requireOwner();
    const input = createInvoiceSchema.parse(rawInput);

    const today = format(new Date(), "yyyyMMdd");
    const uniquePart = crypto.randomUUID().slice(0, 8);
    const invoiceNumber = `INV-${today}-${uniquePart}`;

    let subtotal = 0;
    let taxAmount = 0;
    for (const line of input.lines) {
      const lineTotal = line.quantity * line.unitPrice;
      subtotal += lineTotal;
      taxAmount += line.taxAmount;
    }
    const total = subtotal + taxAmount;

    const invoiceId = await db.transaction(async (tx) => {
      // Fetch project to derive customer and validate existence.
      const [project] = await tx
        .select({ customerId: projects.customerId })
        .from(projects)
        .where(eq(projects.id, input.projectId))
        .for("update");
      if (!project) {
        throw new Error("Project not found.");
      }

      const [invoice] = await tx
        .insert(projectInvoices)
        .values({
          projectId: input.projectId,
          customerId: project.customerId,
          invoiceNumber,
          invoiceDate: new Date(input.invoiceDate),
          dueDate: new Date(input.dueDate),
          status: "draft",
          subtotal: String(subtotal),
          taxAmount: String(taxAmount),
          total: String(total),
          balanceDue: String(total),
          createdBy: session.userId,
        })
        .returning({ id: projectInvoices.id });

      if (!invoice) throw new Error("Failed to create invoice");

      if (input.lines.length > 0) {
        await tx.insert(projectInvoiceLines).values(
          input.lines.map((line, index) => ({
            invoiceId: invoice.id,
            description: line.description,
            quantity: String(line.quantity),
            unitPrice: String(line.unitPrice),
            taxAmount: String(line.taxAmount),
            lineTotal: String(line.quantity * line.unitPrice),
            sortOrder: index,
          })),
        );
      }

      return invoice.id;
    });

    return successResponse({ invoiceId });
  } catch (error) {
    return handleActionError(error, "createInvoice", "Failed to create invoice");
  }
}

export async function postInvoice(rawInput: unknown): Promise<ActionResponse<{ entryId: string }>> {
  try {
    const session = await requireOwner();
    const { invoiceId } = postInvoiceSchema.parse(rawInput);

    return await db.transaction(async (tx) => {
      const [invoice] = await tx
        .select()
        .from(projectInvoices)
        .where(eq(projectInvoices.id, invoiceId))
        .for("update");

      if (!invoice) {
        throw new Error("Invoice not found.");
      }

      if (!canPostInvoice(invoice.status)) {
        throw new Error(`Cannot post invoice in status: ${invoice.status}`);
      }

      // Verify the project is completed before recognizing revenue.
      // Revenue must only be recognized for completed projects.
      const [project] = await tx
        .select({ status: projects.status })
        .from(projects)
        .where(eq(projects.id, invoice.projectId))
        .for("update");
      if (!project) {
        throw new Error("Project not found for this invoice.");
      }
      if (project.status !== "completed") {
        throw new Error(
          `Cannot post invoice: project status is '${project.status}', expected 'completed'.`,
        );
      }

      const totalAmount = Number(invoice.total);

      const { entryId } = await createBalancedJournalEntry({
        tx,
        entryDate: invoice.invoiceDate,
        memo: `Invoice ${invoice.invoiceNumber}`,
        sourceType: "project_invoice",
        sourceId: invoice.id,
        projectId: invoice.projectId,
        createdBy: session.userId,
        lines: [
          { accountCode: "accounts_receivable", debit: totalAmount, credit: 0 },
          { accountCode: "solar_installation_revenue", debit: 0, credit: totalAmount },
        ],
      });

      await tx
        .update(projectInvoices)
        .set({
          status: "unpaid",
          postedEntryId: entryId,
          updatedAt: new Date(),
        })
        .where(eq(projectInvoices.id, invoiceId));

      await invalidateFinanceCacheForWrite();

      return successResponse({ entryId });
    });
  } catch (error) {
    return handleActionError(error, "postInvoice", "Failed to post invoice");
  }
}
