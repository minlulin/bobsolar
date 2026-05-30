import { z } from "zod";
import { paymentTypeSchema } from "@/lib/domain/payment";

export const paymentAllocationSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.number().positive(),
});

export const recordPaymentSchema = z.object({
  projectId: z.uuid(),
  amount: z.number().min(0.01),
  paymentType: paymentTypeSchema.default("final"),
  paymentMethodId: z.uuid(),
  paymentDate: z.coerce.date(),
  reference: z.string().max(200).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  allocations: z.array(paymentAllocationSchema).optional(),
});

export type RecordPayment = z.infer<typeof recordPaymentSchema>;
