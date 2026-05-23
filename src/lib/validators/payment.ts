import { z } from "zod";

export const recordPaymentSchema = z.object({
  projectId: z.uuid(),
  amount: z.number().int().min(1),
  paymentType: z.enum(["advance", "final"]).default("final"),
  paymentMethodId: z.uuid(),
  paymentDate: z.coerce.date(),
  reference: z.string().max(200).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export type RecordPayment = z.infer<typeof recordPaymentSchema>;
