import { z } from "zod";
import { CASH_ACCOUNT_CODES } from "@/lib/domain/finance";

export const cashTransferSchema = z
  .object({
    fromAccount: z.enum(CASH_ACCOUNT_CODES),
    toAccount: z.enum(CASH_ACCOUNT_CODES),
    amount: z.number().positive("Transfer amount must be greater than zero"),
    date: z.coerce.date(),
    reference: z.string().max(100).optional(),
    notes: z.string().max(500).optional(),
  })
  .refine((data) => data.fromAccount !== data.toAccount, {
    message: "Source and destination accounts must be different",
    path: ["toAccount"],
  });

export type CashTransferInput = z.input<typeof cashTransferSchema>;
export type CashTransferOutput = z.output<typeof cashTransferSchema>;
