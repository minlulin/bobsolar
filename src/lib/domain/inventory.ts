import { z } from "zod";
import { inventoryCategoryEnum, inventoryUnitEnum } from "@/lib/db/schema";

export const INVENTORY_CATEGORIES = inventoryCategoryEnum.enumValues;
export type InventoryCategory = (typeof inventoryCategoryEnum.enumValues)[number];
export const inventoryCategorySchema = z.enum(INVENTORY_CATEGORIES);

export const INVENTORY_UNITS = inventoryUnitEnum.enumValues;
export type InventoryUnit = (typeof inventoryUnitEnum.enumValues)[number];
export const inventoryUnitSchema = z.enum(INVENTORY_UNITS);
