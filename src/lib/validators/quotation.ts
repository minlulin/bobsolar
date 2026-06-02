import { z } from "zod";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "@/lib/domain/policies";
import {
  canTransitionQuotationStatus,
  QUOTATION_STATUS_TRANSITIONS,
  quotationStatusSchema,
} from "@/lib/domain/quotation";
import { MYANMAR_TAX } from "@/lib/domain/tax";

export { canTransitionQuotationStatus, QUOTATION_STATUS_TRANSITIONS };

export const quotationItemSchema = z
  .object({
    itemId: z.uuid().optional().nullable(),
    description: z.string().min(1, "Description is required"),
    quantity: z.number().min(0.01, "Quantity must be at least 0.01"),
    unitPrice: z.number().nonnegative("Price cannot be negative"),
    discountPercentage: z.number().min(0).max(100).default(0),
    sortOrder: z.number().int().nonnegative().default(0),
    id: z.string().optional(),
    category: z.string().optional().nullable(),
  })
  .superRefine((item, ctx) => {
    if (item.itemId && item.quantity < 0.01) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Inventory item quantity must be at least 0.01",
        path: ["quantity"],
      });
    }
  });

export const createQuotationSchema = z.object({
  customerId: z.uuid("Customer is required"),
  items: z.array(quotationItemSchema).min(1, "At least one item is required"),
  discountPercent: z.number().min(0).max(100).default(0),
  taxPercent: z.number().min(0).max(100).default(MYANMAR_TAX.COMMERCIAL_TAX_RATE),
  notes: z.string().optional().nullable(),
  validUntil: z.date().optional().nullable(),
  quotationDate: z.date().optional().nullable(),
});

export type CreateQuotation = z.input<typeof createQuotationSchema>;

export const updateQuotationStatusSchema = z.object({
  id: z.uuid(),
  status: quotationStatusSchema,
});

export const quotationFilterSchema = z.object({
  status: quotationStatusSchema.optional().nullable(),
  customerId: z.uuid().optional().nullable(),
  search: z.string().optional().nullable(),
  isArchived: z.boolean().optional().nullable(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(DEFAULT_PAGE_LIMIT),
});

export type QuotationFilter = z.infer<typeof quotationFilterSchema>;
export type QuotationFilterInput = z.input<typeof quotationFilterSchema>;
export type QuotationItemInput = z.infer<typeof quotationItemSchema>;

export const updateQuotationWithIdSchema = createQuotationSchema.partial().extend({
  id: z.uuid(),
});

export const updateQuotationSchema = createQuotationSchema.partial();

export type UpdateQuotation = z.input<typeof updateQuotationSchema>;
