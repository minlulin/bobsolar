import { z } from 'zod';

export const quotationItemSchema = z.object({
  itemId: z.string().uuid().optional().nullable(),
  description: z.string().min(1, 'Description is required'),
  quantity: z.number().positive('Quantity must be positive'),
  unitPrice: z.number().nonnegative('Price cannot be negative'),
  // .optional() を完全に削除し、default(0) のみにすることで number 型を確定させる
  discountPercentage: z.number().min(0).max(100).default(0),
});

export const createQuotationSchema = z.object({
  customerId: z.string().uuid('Customer is required'),
  items: z.array(quotationItemSchema).min(1, 'At least one item is required'),
  discountPercent: z.number().min(0).max(100).default(0),
  taxPercent: z.number().min(0).max(100).default(5),
  notes: z.string().optional().nullable(),
  validUntil: z.date().optional().nullable(),
});

// Use z.input for form types — matches zodResolver's expected input shape
// where .default() fields are optional (filled in during validation).
// Use z.infer (output) when you need the validated/parsed result.
export type CreateQuotation = z.input<typeof createQuotationSchema>;

export const updateQuotationStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['draft', 'sent', 'accepted', 'rejected', 'expired']),
});

export const quotationFilterSchema = z.object({
  status: z
    .enum(['draft', 'sent', 'accepted', 'rejected', 'expired'])
    .optional()
    .nullable(),
  customerId: z.string().uuid().optional().nullable(),
  search: z.string().optional().nullable(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

export type QuotationFilter = z.infer<typeof quotationFilterSchema>;
export type QuotationFilterInput = z.input<typeof quotationFilterSchema>;
export type QuotationItemInput = z.infer<typeof quotationItemSchema>;

export const updateQuotationSchema = createQuotationSchema.partial().extend({
  id: z.string().uuid(),
});

export type UpdateQuotation = z.input<typeof updateQuotationSchema>;

export const QUOTATION_STATUS_TRANSITIONS: Record<
  QuotationStatus,
  QuotationStatus[]
> = {
  draft: ['sent', 'draft'],
  sent: ['accepted', 'rejected', 'expired'],
  accepted: ['draft', 'rejected'],
  rejected: ['draft'],
  expired: ['draft'],
};

export type QuotationStatus =
  | 'draft'
  | 'sent'
  | 'accepted'
  | 'rejected'
  | 'expired';

export function canTransitionStatus(
  currentStatus: QuotationStatus,
  newStatus: QuotationStatus,
): boolean {
  const allowed = QUOTATION_STATUS_TRANSITIONS[currentStatus];
  return allowed?.includes(newStatus) ?? false;
}
