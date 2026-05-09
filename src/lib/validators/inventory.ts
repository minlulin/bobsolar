import { z } from 'zod';
import { inventoryCategoryEnum, inventoryUnitEnum } from '../db/schema';

export const createInventoryItemSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name is too long'),
  category: z.enum(inventoryCategoryEnum.enumValues),
  unit: z.enum(inventoryUnitEnum.enumValues),
  unitPrice: z.number().min(0, 'Price must be 0 or greater'),
  stockQty: z.number().int().min(0, 'Stock must be 0 or greater'),
  brand: z.string().max(100, 'Brand is too long').optional().nullable(),
  modelNumber: z
    .string()
    .max(100, 'Model number is too long')
    .optional()
    .nullable(),
  isActive: z.boolean(),
});

export const updateInventoryItemSchema = createInventoryItemSchema
  .partial()
  .extend({
    id: z.string().uuid(),
  });

export const inventoryFilterSchema = z.object({
  category: z.enum(inventoryCategoryEnum.enumValues).optional().nullable(),
  search: z.string().optional().nullable(),
  isActive: z.boolean().optional().nullable(),
});

export type CreateInventoryItem = z.infer<typeof createInventoryItemSchema>;
export type UpdateInventoryItem = z.infer<typeof updateInventoryItemSchema>;
export type InventoryFilter = z.infer<typeof inventoryFilterSchema>;
