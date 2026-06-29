import { z } from "zod";

export const createChangeOrderItemSchema = z.object({
  itemId: z.string().uuid().optional().nullable(),
  description: z.string().min(1, "Description is required"),
  quantity: z.number().positive("Quantity must be greater than zero"),
  unitPrice: z.number().nonnegative("Unit price must be non-negative"),
  isAddition: z.boolean().default(true),
});

export const createChangeOrderSchema = z.object({
  projectId: z.string().uuid("Project ID is required"),
  description: z.string().min(1, "Description is required"),
  originalQuotationId: z.string().uuid().optional().nullable(),
  items: z.array(createChangeOrderItemSchema).min(1, "At least one item is required"),
});

export type CreateChangeOrderInput = z.infer<typeof createChangeOrderSchema>;
export type CreateChangeOrderItemInput = z.infer<typeof createChangeOrderItemSchema>;
