import { z } from "zod";
import { type CostType, costTypeEnum } from "@/lib/db/schema";

export const COST_TYPES = costTypeEnum.enumValues;
export const costTypeSchema = z.enum(COST_TYPES);

/** UI label map for cost types */
export const COST_TYPE_LABELS: Record<CostType, string> = {
  material: "Materials",
  labor: "Labor",
  transport: "Logistics",
  misc: "Miscellaneous",
  general: "General",
};

/** UI filter (includes 'all') */
export const COST_FILTERS = ["all", ...COST_TYPES] as const;
export type CostFilter = (typeof COST_FILTERS)[number];
