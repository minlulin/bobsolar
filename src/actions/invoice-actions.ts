"use server";

import { format, startOfDay } from "date-fns";
import { and, asc, count, desc, eq, ilike, inArray, lt, or, sql } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { requireAuth, requireOwner } from "@/lib/auth/validate";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { customers, projectInvoiceLines, projectInvoices, projects } from "@/lib/db/schema";
import { canPostInvoice, isInvoiceOverdue, OPEN_INVOICE_STATUSES } from "@/lib/domain/invoice";
import { invalidateFinanceCacheForWrite } from "@/lib/finance/cache-invalidation";
import { createBalancedJournalEntry } from "@/lib/finance/ledger";
import { type ActionResponse, successResponse } from "@/lib/utils/action-response";
import { handleActionError } from "@/lib/utils/error";
import { escapeLikePattern } from "@/lib/utils/search";
import {
  createInvoiceSchema,
  invoiceListFilterSchema,
  postInvoiceSchema,
} from "@/lib/validators/invoice";

export type InvoiceListRow = {
  id: string;
  invoiceNumber: string;
  projectId: string;
  projectNumber: string;
  customerId: string;
  customerName: string;
  invoiceDate: Date;
  dueDate: Date;
  status: (typeof projectInvoices.$inferSelect)["status"];
  subtotal: number;
  taxAmount: number;
  total: number;
  paidAmount: number;
  balanceDue: number;
  isOverdue: boolean;
  isPosted: boolean;
};

export type InvoiceListSummary = {
  open: number;
  overdue: number;
  draft: number;
  paid: number;
  voided: number;
  openBalanceTotal: number;
};

export type InvoiceListResult = {
  items: InvoiceListRow[];
  total: number;
  summary: InvoiceListSummary;
};

function startOfTodayLocal(): Date {
  return startOfDay(new Date());
}

export async function getInvoices(
  rawFilters: unknown = {},
): Promise<ActionResponse<InvoiceListResult>> {
  try {
    await requireAuth();

    const filters = invoiceListFilterSchema.parse(rawFilters);
    const { tab, customerId, search, page, limit } = filters;
    const offset = (page - 1) * limit;

    const startOfToday = startOfTodayLocal();

    // Tab → status/date predicate. Tabs drive what the operator chases daily:
    // open money, overdue money, un-posted drafts, settled, everything.
    const openStatusCond = inArray(projectInvoices.status, [...OPEN_INVOICE_STATUSES]);
    const tabCond =
      tab === "open"
        ? openStatusCond
        : tab === "overdue"
          ? and(openStatusCond, lt(projectInvoices.dueDate, startOfToday))
          : tab === "draft"
            ? eq(projectInvoices.status, "draft")
            : tab === "paid"
              ? eq(projectInvoices.status, "paid")
              : undefined;

    const searchCond = search?.trim()
      ? (() => {
          const escaped = escapeLikePattern(search.trim());
          return or(
            ilike(projectInvoices.invoiceNumber, `%${escaped}%`),
            ilike(projects.projectNumber, `%${escaped}%`),
            ilike(customers.name, `%${escaped}%`),
          );
        })()
      : undefined;

    const whereClause = and(
      tabCond,
      customerId ? eq(projectInvoices.customerId, customerId) : undefined,
      searchCond,
    );

    // Chase-the-money tabs sort by earliest due date first; archive-style
    // tabs (paid/all/draft) show the newest documents first.
    const orderBy =
      tab === "open" || tab === "overdue"
        ? [asc(projectInvoices.dueDate), asc(projectInvoices.invoiceNumber)]
        : [desc(projectInvoices.createdAt), desc(projectInvoices.invoiceNumber)];

    const [rows, totals, summaryRows] = await Promise.all([
      db
        .select({
          invoice: projectInvoices,
          projectNumber: projects.projectNumber,
          customerName: customers.name,
        })
        .from(projectInvoices)
        .innerJoin(projects, eq(projectInvoices.projectId, projects.id))
        .innerJoin(customers, eq(projectInvoices.customerId, customers.id))
        .where(whereClause)
        .orderBy(...orderBy)
        .limit(limit)
        .offset(offset),
      db
        .select({ total: count() })
        .from(projectInvoices)
        .innerJoin(projects, eq(projectInvoices.projectId, projects.id))
        .innerJoin(customers, eq(projectInvoices.customerId, customers.id))
        .where(whereClause),
      // Global tab counts + outstanding balance, independent of tab/search
      // filters, so the tab badges always reflect the whole book.
      db
        .select({
          draft: sql<number>`cast(count(*) filter (where ${projectInvoices.status} = 'draft') as int)`,
          open: sql<number>`cast(count(*) filter (where ${projectInvoices.status} in ('unpaid', 'partial')) as int)`,
          overdue: sql<number>`cast(count(*) filter (where ${projectInvoices.status} in ('unpaid', 'partial') and ${projectInvoices.dueDate} < ${startOfToday}) as int)`,
          paid: sql<number>`cast(count(*) filter (where ${projectInvoices.status} = 'paid') as int)`,
          voided: sql<number>`cast(count(*) filter (where ${projectInvoices.status} = 'voided') as int)`,
          openBalanceTotal: sql<string>`coalesce(sum(cast(${projectInvoices.balanceDue} as numeric)) filter (where ${projectInvoices.status} in ('unpaid', 'partial')), 0)`,
        })
        .from(projectInvoices),
    ]);

    const summaryRow = summaryRows[0];
    const summary: InvoiceListSummary = {
      open: Number(summaryRow?.open ?? 0),
      overdue: Number(summaryRow?.overdue ?? 0),
      draft: Number(summaryRow?.draft ?? 0),
      paid: Number(summaryRow?.paid ?? 0),
      voided: Number(summaryRow?.voided ?? 0),
      openBalanceTotal: Math.round(Number(summaryRow?.openBalanceTotal ?? 0)),
    };

    const items: InvoiceListRow[] = rows.map((row) => ({
      id: row.invoice.id,
      invoiceNumber: row.invoice.invoiceNumber,
      projectId: row.invoice.projectId,
      projectNumber: row.projectNumber,
      customerId: row.invoice.customerId,
      customerName: row.customerName,
      invoiceDate: row.invoice.invoiceDate,
      dueDate: row.invoice.dueDate,
      status: row.invoice.status,
      subtotal: Number(row.invoice.subtotal),
      taxAmount: Number(row.invoice.taxAmount),
      total: Number(row.invoice.total),
      paidAmount: Number(row.invoice.paidAmount),
      balanceDue: Number(row.invoice.balanceDue),
      isOverdue: isInvoiceOverdue(row.invoice.status, row.invoice.dueDate, new Date()),
      isPosted: row.invoice.status !== "draft",
    }));

    return successResponse({
      items,
      total: totals[0]?.total ?? 0,
      summary,
    });
  } catch (error) {
    return handleActionError(error, "getInvoices", "Failed to fetch invoices");
  }
}

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

    revalidateTag(CACHE_TAGS.INVOICES_LIST, "max");
    revalidatePath("/invoices");

    return successResponse({ invoiceId });
  } catch (error) {
    return handleActionError(error, "createInvoice", "Failed to create invoice");
  }
}

export async function postInvoice(rawInput: unknown): Promise<ActionResponse<{ entryId: string }>> {
  try {
    const session = await requireOwner();
    const { invoiceId } = postInvoiceSchema.parse(rawInput);

    const result = await db.transaction(async (tx) => {
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

    revalidateTag(CACHE_TAGS.INVOICES_LIST, "max");
    revalidatePath("/invoices");

    return result;
  } catch (error) {
    return handleActionError(error, "postInvoice", "Failed to post invoice");
  }
}
