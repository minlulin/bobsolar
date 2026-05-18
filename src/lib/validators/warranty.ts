import { z } from "zod";

export const warrantyListFilterSchema = z.object({
  tab: z.enum(["overdue", "due_soon", "upcoming", "resolved", "all"]).default("all"),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type WarrantyListFilter = z.infer<typeof warrantyListFilterSchema>;
