import { z } from "zod";
import { type CostType, costTypeEnum } from "@/lib/db/schema";
import type { LedgerAccountCode } from "@/lib/domain/finance";

export const COST_TYPES = costTypeEnum.enumValues;
export const costTypeSchema = z.enum(COST_TYPES);

/** SSoT: maps each cost type to its ledger expense account code. */
export const COST_TYPE_EXPENSE_MAP: Record<CostType, LedgerAccountCode> = {
  material: "material_expense",
  labor: "labor_expense",
  transport: "transport_expense",
  general: "general_expense",
  misc: "misc_expense",
} as const satisfies Record<CostType, LedgerAccountCode>;

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
