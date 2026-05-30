import { z } from "zod";
import { voucherTypeSchema } from "@/lib/domain/voucher";
import { dbDecimalToNumberSchema } from "./common";

export const generateVoucherSchema = z.object({
  projectId: z.uuid(),
  voucherType: voucherTypeSchema,
  totalAmount: dbDecimalToNumberSchema.pipe(z.number().min(0)),
  paidAmount: dbDecimalToNumberSchema.pipe(z.number().min(0)),
  notes: z.string().max(2000).optional().nullable(),
});

export type GenerateVoucherInput = z.infer<typeof generateVoucherSchema>;
