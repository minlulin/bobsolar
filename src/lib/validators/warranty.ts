import { z } from "zod";

import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../domain/policies";

export const warrantyListFilterSchema = z.object({
  tab: z.enum(["overdue", "due_soon", "upcoming", "resolved", "all"]).default("all"),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(DEFAULT_PAGE_LIMIT),
  offset: z.coerce.number().int().min(0).default(0),
});

export type WarrantyListFilter = z.infer<typeof warrantyListFilterSchema>;
