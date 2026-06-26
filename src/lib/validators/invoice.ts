import { z } from "zod";

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
