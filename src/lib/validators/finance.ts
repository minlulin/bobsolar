import { z } from "zod";

export const periodFilterSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export type FinancePeriodFilter = z.input<typeof periodFilterSchema>;
export type FinancePeriodFilterParsed = z.output<typeof periodFilterSchema>;
