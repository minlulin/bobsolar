import { z } from 'zod';

export const recordPaymentSchema = z.object({
  projectId: z.uuid(),
  amount: z.number().int().min(1),
  paymentMethodId: z.uuid(),
  paymentDate: z.coerce.date(),
  reference: z.string().max(200).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
