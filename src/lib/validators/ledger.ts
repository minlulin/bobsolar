import { z } from "zod";
import { JOURNAL_SOURCE_TYPES, LEDGER_ACCOUNT_CODES } from "@/lib/domain/finance";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "@/lib/domain/policies";

export const ledgerFilterSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  accountCode: z.enum(LEDGER_ACCOUNT_CODES).optional(),
  projectId: z.uuid().optional(),
  sourceType: z.enum(JOURNAL_SOURCE_TYPES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(DEFAULT_PAGE_LIMIT),
});

export type LedgerFilter = z.input<typeof ledgerFilterSchema>;
export type LedgerFilterParsed = z.output<typeof ledgerFilterSchema>;
