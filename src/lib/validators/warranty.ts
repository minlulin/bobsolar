import { z } from 'zod';

export const warrantyListFilterSchema = z.object({
  tab: z
    .enum(['overdue', 'due_soon', 'upcoming', 'resolved', 'all'])
    .default('all'),
});

export type WarrantyListFilter = z.infer<typeof warrantyListFilterSchema>;
