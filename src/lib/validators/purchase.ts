import { z } from "zod";

export const purchaseOrderItemSchema = z.object({
  itemId: z.uuid(),
  description: z.string().min(1, "Description is required"),
  quantity: z.coerce.number().min(0.01, "Quantity must be at least 0.01"),
  unitPrice: z.coerce.number().min(0, "Unit price cannot be negative"),
});

export const createPurchaseOrderSchema = z.object({
  poNumber: z.string().min(1, "PO Number is required"),
  supplierId: z.uuid("Please select a supplier"),
  billDate: z.coerce.date().optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  items: z.array(purchaseOrderItemSchema).min(1, "At least one item is required"),
});

export const payPurchaseOrderSchema = z.object({
  purchaseOrderId: z.uuid(),
  amount: z.coerce.number().min(1, "Amount must be greater than 0"),
  paymentMethodId: z.uuid("Please select a payment method"),
  reference: z.string().max(255).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export type PurchaseOrderItemInput = z.input<typeof purchaseOrderItemSchema>;
export type CreatePurchaseOrder = z.input<typeof createPurchaseOrderSchema>;
export type PayPurchaseOrder = z.input<typeof payPurchaseOrderSchema>;
