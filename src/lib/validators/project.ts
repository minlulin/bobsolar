import { z } from 'zod';
import {
  projectStatusSchema,
  costTypeSchema,
  remarkTypeSchema,
  alertTypeSchema,
  type ProjectStatus,
  canTransitionProjectStatus,
  permittedNextStatuses,
  isProjectStatus,
} from '@/lib/domain/enums';

// Re-export for backwards compatibility
export {
  ProjectStatus,
  canTransitionProjectStatus,
  permittedNextStatuses,
  isProjectStatus,
};

export const convertToProjectSchema = z.object({
  quotationId: z.uuid(),
  siteAddress: z.string().max(500).optional().nullable(),
  systemSizeKwp: z.number().min(0).max(99999).optional().nullable(),
  startDate: z.coerce.date().optional().nullable(),
  targetCompletion: z.coerce.date().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

export const updateProjectSchema = z.object({
  id: z.uuid(),
  status: projectStatusSchema.optional(),
  siteAddress: z.string().max(500).optional().nullable(),
  systemSizeKwp: z.number().min(0).max(99999).optional().nullable(),
  targetCompletion: z.coerce.date().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

export const addProjectCostSchema = z.object({
  projectId: z.uuid(),
  itemId: z.uuid().optional().nullable(),
  description: z.string().min(1).max(500),
  amount: z.number().int().min(0),
  costType: costTypeSchema,
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
  scope: z.enum(['active', 'completed']).default('active'),
  status: projectStatusSchema.optional(),
  search: z.string().optional().nullable(),
  year: z.coerce.number().int().min(2000).max(2100).optional().nullable(),
  completedFrom: z.coerce.date().optional().nullable(),
  completedTo: z.coerce.date().optional().nullable(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ConvertToProjectInput = z.infer<typeof convertToProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type AddProjectCostInput = z.infer<typeof addProjectCostSchema>;
export type AddProjectRemarkInput = z.infer<typeof addProjectRemarkSchema>;
export type CreateWarrantyAlertInput = z.infer<
  typeof createWarrantyAlertSchema
>;
export type ProjectListFilter = z.infer<typeof projectListFilterSchema>;
