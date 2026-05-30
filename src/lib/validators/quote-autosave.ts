import { z } from "zod";
import { quotationItemSchema } from "@/lib/validators/quotation";

export const QUOTE_AUTOSAVE_SCHEMA_VERSION = 1 as const;

const autosavePayloadSchema = z.object({
  customerId: z.uuid().nullable(),
  items: z.array(quotationItemSchema),
  discountPercent: z.number().min(0).max(100),
  taxPercent: z.number().min(0).max(100),
  notes: z.string(),
  validUntilIso: z.string().datetime().nullable(),
  quotationDateIso: z.string().datetime().nullable(),
});

export const quoteAutosaveDraftSchema = z.object({
  version: z.literal(QUOTE_AUTOSAVE_SCHEMA_VERSION),
  mode: z.enum(["create", "edit"]),
  quotationId: z.uuid().nullable(),
  serverUpdatedAtIso: z.string().datetime().nullable(),
  savedAt: z.number().int().nonnegative(),
  dirty: z.boolean(),
  payload: autosavePayloadSchema,
});

export type QuoteAutosaveDraft = z.infer<typeof quoteAutosaveDraftSchema>;
export type QuoteAutosavePayload = z.infer<typeof autosavePayloadSchema>;
