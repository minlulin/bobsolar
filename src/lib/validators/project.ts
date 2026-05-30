import { z } from "zod";
import { alertTypeSchema } from "@/lib/domain/alert-types";
import { costTypeSchema } from "@/lib/domain/cost-types";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "@/lib/domain/policies";
import {
  canTransitionProjectStatus,
  isProjectStatus,
  permittedNextStatuses,
  projectStatusSchema,
} from "@/lib/domain/project";
import { remarkTypeSchema } from "@/lib/domain/remark-types";

// Re-export for backwards compatibility
export { canTransitionProjectStatus, isProjectStatus, permittedNextStatuses };

export const convertToProjectSchema = z.object({
  quotationId: z.uuid(),
  siteAddress: z.string().max(500).optional(),
  systemSizeKwp: z.number().min(0).max(99999).optional(),
  startDate: z.coerce.date().optional().nullable(),
  targetCompletion: z.coerce.date().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

export const updateProjectSchema = z.object({
  id: z.uuid(),
  status: projectStatusSchema.optional(),
  siteAddress: z.string().max(500).optional(),
  systemSizeKwp: z.number().min(0).max(99999).optional(),
  targetCompletion: z.coerce.date().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

export const addProjectCostSchema = z.object({
  projectId: z.uuid(),
  itemId: z.uuid().optional().nullable(),
  paymentMethodId: z.uuid(),
  description: z.string().min(1).max(500),
  amount: z.number().min(0.01, "Cost amount must be at least 0.01"),
  costType: costTypeSchema,
  incurredDate: z.coerce.date(),
});

export const consumeProjectInventorySchema = z.object({
  projectId: z.uuid(),
  inventoryItemId: z.uuid(),
  quantity: z.number().int().min(1, "Quantity must be a whole number at least 1"),
  description: z.string().min(1).max(500),
  incurredDate: z.coerce.date(),
});

export const addProjectRemarkSchema = z.object({
  projectId: z.uuid(),
  content: z.string().min(1).max(8000),
  remarkType: remarkTypeSchema,
});

export const createWarrantyAlertSchema = z.object({
  projectId: z.uuid(),
  alertType: alertTypeSchema,
  description: z.string().min(1).max(2000),
  dueDate: z.coerce.date(),
});

export const projectListFilterSchema = z.object({
  scope: z.enum(["active", "completed"]).default("active"),
  status: projectStatusSchema.optional(),
  search: z.string().optional().nullable(),
  year: z.coerce.number().int().min(2000).max(2100).optional().nullable(),
  completedFrom: z.coerce.date().optional().nullable(),
  completedTo: z.coerce.date().optional().nullable(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(DEFAULT_PAGE_LIMIT),
});

export type ConvertToProject = z.infer<typeof convertToProjectSchema>;
export type UpdateProject = z.infer<typeof updateProjectSchema>;
export type AddProjectCost = z.infer<typeof addProjectCostSchema>;
export type ConsumeProjectInventory = z.infer<typeof consumeProjectInventorySchema>;
export type AddProjectRemark = z.infer<typeof addProjectRemarkSchema>;
export type CreateWarrantyAlert = z.infer<typeof createWarrantyAlertSchema>;
export type ProjectListFilter = z.infer<typeof projectListFilterSchema>;
