import { z } from 'zod';
import { inventoryCategoryEnum, inventoryUnitEnum } from '../db/schema';

const panelSpecificationsSchema = z
  .object({
    brandModel: z.string().min(1, 'Panel brand/model is required'),
    cellType: z.enum(['n_type', 'p_type']),
    wattageW: z.number().positive('Panel wattage must be greater than 0'),
    warranty: z.string().min(1, 'Panel warranty is required'),
  })
  .strict();

const inverterSpecificationsSchema = z
  .object({
    brandModel: z.string().min(1, 'Inverter brand/model is required'),
    systemType: z.enum(['hybrid', 'off_grid', 'on_grid']),
    ratedPower: z.string().min(1, 'Inverter rated power is required'),
    phase: z.enum(['single_phase', 'three_phase']),
    maxPvInput: z.string().min(1, 'Inverter max PV input is required'),
    warranty: z.string().min(1, 'Inverter warranty is required'),
  })
  .strict();

const batterySpecificationsSchema = z
  .object({
    brandModel: z.string().min(1, 'Battery brand/model is required'),
    chemistryType: z.enum(['lifepo4', 'gel', 'lead_acid']),
    voltageV: z.number().positive('Battery voltage must be greater than 0'),
    capacityAh: z.number().positive('Battery capacity must be greater than 0'),
    warranty: z.string().min(1, 'Battery warranty is required'),
  })
  .strict();

const mountingSpecificationsSchema = z
  .object({
    type: z.string().min(1, 'Mounting structure type is required'),
  })
  .strict();

const cableSpecificationsSchema = z
  .object({
    cableType: z.enum(['dc_cable', 'ac_cable', 'earth_wire']),
    sizeCrossSection: z.string().min(1, 'Cable cross-section size is required'),
    unitOfMeasurement: z
      .string()
      .min(1, 'Cable unit of measurement is required'),
  })
  .strict();

const accessorySpecificationsSchema = z
  .object({
    type: z.string().min(1, 'Accessory type is required'),
    ratingAmpere: z.number().positive('Accessory ampere rating must be > 0'),
    voltageRating: z.string().min(1, 'Accessory voltage rating is required'),
  })
  .strict();

const laborSpecificationsSchema = z.null();

const inventorySpecificationsSchemaByCategory = {
  panel: panelSpecificationsSchema,
  inverter: inverterSpecificationsSchema,
  battery: batterySpecificationsSchema,
  mounting: mountingSpecificationsSchema,
  cable: cableSpecificationsSchema,
  accessory: accessorySpecificationsSchema,
  labor: laborSpecificationsSchema,
} as const;

const specificationsByCategorySchema = z.discriminatedUnion('category', [
  z.object({
    category: z.literal('panel'),
    specifications: panelSpecificationsSchema,
  }),
  z.object({
    category: z.literal('inverter'),
    specifications: inverterSpecificationsSchema,
  }),
  z.object({
    category: z.literal('battery'),
    specifications: batterySpecificationsSchema,
  }),
  z.object({
    category: z.literal('mounting'),
    specifications: mountingSpecificationsSchema,
  }),
  z.object({
    category: z.literal('cable'),
    specifications: cableSpecificationsSchema,
  }),
  z.object({
    category: z.literal('accessory'),
    specifications: accessorySpecificationsSchema,
  }),
  z.object({
    category: z.literal('labor'),
    specifications: laborSpecificationsSchema,
  }),
]);

const createInventoryItemBaseSchema = z.object({
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
  specifications: z.unknown(),
  isActive: z.boolean(),
});

export const createInventoryItemSchema =
  createInventoryItemBaseSchema.superRefine((value, ctx) => {
    const parsed = specificationsByCategorySchema.safeParse({
      category: value.category,
      specifications: value.specifications,
    });

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        ctx.addIssue({
          code: 'custom',
          message: issue.message,
          path: issue.path,
        });
      }
    }
  });

export const updateInventoryItemSchema = createInventoryItemBaseSchema
  .partial()
  .extend({
    id: z.uuid(),
    category: z.enum(inventoryCategoryEnum.enumValues).optional(),
    specifications: z.unknown().optional(),
    isActive: z.boolean().optional(),
  });

export const updateInventoryItemPayloadSchema =
  updateInventoryItemSchema.superRefine((value, ctx) => {
    const hasCategory = value.category !== undefined;
    const hasSpecifications = value.specifications !== undefined;

    if (hasCategory !== hasSpecifications) {
      ctx.addIssue({
        code: 'custom',
        message:
          'Category and specifications must be updated together to avoid stale spec fields.',
        path: hasCategory ? ['specifications'] : ['category'],
      });
      return;
    }

    if (hasCategory && hasSpecifications) {
      const category = value.category;
      if (!category) {
        return;
      }

      const parsed = inventorySpecificationsSchemaByCategory[
        category
      ].safeParse(value.specifications);

      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          ctx.addIssue({
            code: 'custom',
            message: issue.message,
            path: ['specifications', ...issue.path],
          });
        }
      }
    }
  });

export const inventoryFilterSchema = z.object({
  category: z.enum(inventoryCategoryEnum.enumValues).optional().nullable(),
  search: z.string().optional().nullable(),
  isActive: z.boolean().optional().nullable(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type CreateInventoryItem = z.infer<typeof createInventoryItemSchema>;
export type UpdateInventoryItem = z.infer<typeof updateInventoryItemSchema>;
export type InventorySpecificationsByCategory = z.infer<
  typeof specificationsByCategorySchema
>;
// Input type for callers (defaults are optional at the boundary).
export type InventoryFilter = z.input<typeof inventoryFilterSchema>;
// Parsed type after Zod defaults are applied.
export type InventoryFilterParsed = z.infer<typeof inventoryFilterSchema>;
