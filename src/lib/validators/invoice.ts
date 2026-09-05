import { z } from "zod";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "@/lib/domain/policies";

export const invoiceLineSchema = z.object({
  description: z.string().min(1, "Description is required"),
  quantity: z.number().positive("Quantity must be positive"),
  unitPrice: z.number().min(0, "Unit price cannot be negative"),
  taxAmount: z.number().min(0).default(0),
});

export const createInvoiceSchema = z
  .object({
    projectId: z.string().uuid("Invalid project ID"),
    invoiceDate: z.string().datetime(),
    dueDate: z.string().datetime(),
    lines: z.array(invoiceLineSchema).min(1, "At least one line item is required"),
    notes: z.string().optional(),
  })
  .refine((data) => new Date(data.dueDate) >= new Date(data.invoiceDate), {
    message: "Due date must be on or after invoice date",
    path: ["dueDate"],
  });
export type CreateInvoiceInput = z.input<typeof createInvoiceSchema>;
export type CreateInvoiceParsed = z.output<typeof createInvoiceSchema>;

export const postInvoiceSchema = z.object({
  invoiceId: z.string().uuid(),
});

export const voidInvoiceSchema = z.object({
  invoiceId: z.string().uuid(),
});

export const INVOICE_LIST_TABS = ["open", "overdue", "draft", "paid", "all"] as const;

export type InvoiceListTab = (typeof INVOICE_LIST_TABS)[number];

export const invoiceListFilterSchema = z.object({
  tab: z.enum(INVOICE_LIST_TABS).default("open"),
  customerId: z.string().uuid().optional().nullable(),
  search: z.string().max(100, "Search query is too long").optional().nullable(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(DEFAULT_PAGE_LIMIT),
});

/** Input type for callers (defaults are optional at the boundary). */
export type InvoiceListFilterInput = z.input<typeof invoiceListFilterSchema>;
/** Parsed type after Zod defaults are applied. */
export type InvoiceListFilter = z.output<typeof invoiceListFilterSchema>;
