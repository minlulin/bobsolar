import { z } from "zod";
import { voucherTypeSchema } from "@/lib/domain/voucher";

export const generateVoucherSchema = z.object({
  projectId: z.uuid(),
  voucherType: voucherTypeSchema,
  totalAmount: z.number().int().min(0),
  paidAmount: z.number().int().min(0),
  notes: z.string().max(2000).optional().nullable(),
});

export type GenerateVoucherInput = z.infer<typeof generateVoucherSchema>;
