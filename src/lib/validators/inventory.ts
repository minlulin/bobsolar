import { z } from "zod";
import { inventoryUnitEnum } from "@/lib/db/schema";
import {
  BATTERY_CHEMISTRY_TYPES,
  CABLE_TYPES,
  INVENTORY_CATEGORIES,
  INVERTER_PHASES,
  INVERTER_SYSTEM_TYPES,
  PANEL_CELL_TYPES,
} from "@/lib/domain/inventory";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "@/lib/domain/policies";

const panelSpecificationsSchema = z
  .object({
    brandModel: z.string().min(1, "Panel brand/model is required"),
    cellType: z.enum(PANEL_CELL_TYPES),
    wattageW: z.number().nonnegative("Panel wattage must be 0 or greater"),
    warranty: z.string().min(1, "Panel warranty is required"),
  })
  .strict();

const inverterSpecificationsSchema = z
  .object({
    brandModel: z.string().min(1, "Inverter brand/model is required"),
    systemType: z.enum(INVERTER_SYSTEM_TYPES),
    ratedPower: z.string().min(1, "Inverter rated power is required"),
    phase: z.enum(INVERTER_PHASES),
    maxPvInput: z.string().min(1, "Inverter max PV input is required"),
    warranty: z.string().min(1, "Inverter warranty is required"),
  })
  .strict();

const batterySpecificationsSchema = z
  .object({
    brandModel: z.string().min(1, "Battery brand/model is required"),
    chemistryType: z.enum(BATTERY_CHEMISTRY_TYPES),
    voltageV: z.number().nonnegative("Battery voltage must be 0 or greater"),
    capacityAh: z.number().nonnegative("Battery capacity must be 0 or greater"),
    warranty: z.string().min(1, "Battery warranty is required"),
  })
  .strict();

const mountingSpecificationsSchema = z
  .object({
    type: z.string().min(1, "Mounting structure type is required"),
  })
  .strict();

const cableSpecificationsSchema = z
  .object({
    cableType: z.enum(CABLE_TYPES),
    sizeCrossSection: z.string().min(1, "Cable cross-section size is required"),
    unitOfMeasurement: z.string().min(1, "Cable unit of measurement is required"),
  })
  .strict();

// Accessory: ampere/voltage are optional — not all accessories have ratings
const accessorySpecificationsSchema = z
  .object({
    type: z.string().min(1, "Accessory type is required"),
    ratingAmpere: z.number().nonnegative("Ampere rating must be 0 or greater").optional(),
    voltageRating: z.string().optional(),
  })
  .strict();

// Protection: type required, electrical ratings optional
const protectionSpecificationsSchema = z
  .object({
    type: z.string().min(1, "Protection type (breaker, fuse, etc.) is required"),
    ratingAmpere: z.number().nonnegative("Ampere rating must be 0 or greater").optional(),
    voltageRating: z.string().optional(),
  })
  .strict();

const inventorySpecificationsSchemaByCategory = {
  panel: panelSpecificationsSchema,
  inverter: inverterSpecificationsSchema,
  battery: batterySpecificationsSchema,
  mounting: mountingSpecificationsSchema,
  cable: cableSpecificationsSchema,
  accessory: accessorySpecificationsSchema,
  protection: protectionSpecificationsSchema,
} as const;

const specificationsByCategorySchema = z.discriminatedUnion("category", [
  z.object({
    category: z.literal("panel"),
    specifications: panelSpecificationsSchema,
  }),
  z.object({
    category: z.literal("inverter"),
    specifications: inverterSpecificationsSchema,
  }),
  z.object({
    category: z.literal("battery"),
    specifications: batterySpecificationsSchema,
  }),
  z.object({
    category: z.literal("mounting"),
    specifications: mountingSpecificationsSchema,
  }),
  z.object({
    category: z.literal("cable"),
    specifications: cableSpecificationsSchema,
  }),
  z.object({
    category: z.literal("accessory"),
    specifications: accessorySpecificationsSchema,
  }),
  z.object({
    category: z.literal("protection"),
    specifications: protectionSpecificationsSchema,
  }),
]);

export const createInventoryItemBaseSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name is too long"),
  category: z.enum(INVENTORY_CATEGORIES),
  unit: z.enum(inventoryUnitEnum.enumValues),
  costPrice: z.number().min(0, "Cost price must be 0 or greater"),
  unitPrice: z.number().min(0, "Sell price must be 0 or greater"),
  stockQty: z.number().int().min(0, "Stock must be 0 or greater").default(0),
  brand: z.string().max(100, "Brand is too long").optional().nullable(),
  modelNumber: z.string().max(100, "Model number is too long").optional().nullable(),
  specifications: z.unknown(),
  durationMonths: z.number().int().min(0).optional(),
  isActive: z.boolean(),
});

export const createInventoryItemSchema = createInventoryItemBaseSchema.superRefine((value, ctx) => {
  const parsed = specificationsByCategorySchema.safeParse({
    category: value.category,
    specifications: value.specifications,
  });

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      ctx.addIssue({
        code: "custom",
        message: issue.message,
        path: issue.path,
      });
    }
  }
});

export const updateInventoryItemSchema = createInventoryItemBaseSchema.partial().extend({
  id: z.uuid(),
  category: z.enum(INVENTORY_CATEGORIES).optional(),
  specifications: z.unknown().optional(),
  durationMonths: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const updateInventoryItemPayloadSchema = updateInventoryItemSchema.superRefine(
  (value, ctx) => {
    const hasCategory = value.category !== undefined;
    const hasSpecifications = value.specifications !== undefined;

    if (hasCategory !== hasSpecifications) {
      ctx.addIssue({
        code: "custom",
        message: "Category and specifications must be updated together to avoid stale spec fields.",
        path: hasCategory ? ["specifications"] : ["category"],
      });
      return;
    }

    if (hasCategory && hasSpecifications) {
      const category = value.category;
      if (!category) {
        return;
      }

      const schemaForCategory = inventorySpecificationsSchemaByCategory[category];
      if (!schemaForCategory) {
        ctx.addIssue({
          code: "custom",
          message: `Unknown category: ${category}`,
          path: ["category"],
        });
        return;
      }

      const parsed = schemaForCategory.safeParse(value.specifications);

      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          ctx.addIssue({
            code: "custom",
            message: issue.message,
            path: ["specifications", ...issue.path],
          });
        }
      }
    }
  },
);

export const inventoryFilterSchema = z.object({
  category: z.enum(INVENTORY_CATEGORIES).optional().nullable(),
  search: z.string().optional().nullable(),
  isActive: z.boolean().optional().nullable(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(DEFAULT_PAGE_LIMIT),
});

export type CreateInventoryItem = z.input<typeof createInventoryItemSchema>;
export type UpdateInventoryItem = z.infer<typeof updateInventoryItemSchema>;
export type InventorySpecificationsByCategory = z.infer<typeof specificationsByCategorySchema>;
// Input type for callers (defaults are optional at the boundary).
export type InventoryFilter = z.input<typeof inventoryFilterSchema>;
// Parsed type after Zod defaults are applied.
export type InventoryFilterParsed = z.infer<typeof inventoryFilterSchema>;
