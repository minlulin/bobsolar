import { z } from "zod";
import { JOURNAL_SOURCE_TYPES, LEDGER_ACCOUNT_CODES } from "@/lib/domain/enums";

export const ledgerFilterSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  accountCode: z.enum(LEDGER_ACCOUNT_CODES).optional(),
  projectId: z.string().uuid().optional(),
  sourceType: z.enum(JOURNAL_SOURCE_TYPES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(10).max(100).default(50),
});

export type LedgerFilter = z.input<typeof ledgerFilterSchema>;
export type LedgerFilterParsed = z.output<typeof ledgerFilterSchema>;
