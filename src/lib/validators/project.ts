import { z } from 'zod';

export const projectStatusSchema = z.enum([
  'planning',
  'in_progress',
  'on_hold',
  'completed',
  'cancelled',
]);

export type ProjectStatus = z.infer<typeof projectStatusSchema>;

export const convertToProjectSchema = z.object({
  quotationId: z.string().uuid(),
  siteAddress: z.string().max(500).optional().nullable(),
  systemSizeKwp: z.number().min(0).max(99999).optional().nullable(),
  startDate: z.coerce.date().optional().nullable(),
  targetCompletion: z.coerce.date().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

export const updateProjectSchema = z.object({
  id: z.string().uuid(),
  status: projectStatusSchema.optional(),
  siteAddress: z.string().max(500).optional().nullable(),
  systemSizeKwp: z.number().min(0).max(99999).optional().nullable(),
  targetCompletion: z.coerce.date().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

export const addProjectCostSchema = z.object({
  projectId: z.string().uuid(),
  itemId: z.string().uuid().optional().nullable(),
  description: z.string().min(1).max(500),
  amount: z.number().int().min(0),
  costType: z.enum(['material', 'labor', 'transport', 'misc']),
  incurredDate: z.coerce.date(),
});

export const addProjectRemarkSchema = z.object({
  projectId: z.string().uuid(),
  content: z.string().min(1).max(8000),
  remarkType: z.enum(['note', 'issue', 'update']),
});

export const createWarrantyAlertSchema = z.object({
  projectId: z.string().uuid(),
  alertType: z.enum(['warranty_expiry', 'maintenance_due', 'follow_up']),
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
export type CreateWarrantyAlertInput = z.infer<typeof createWarrantyAlertSchema>;
export type ProjectListFilter = z.infer<typeof projectListFilterSchema>;

const allowedTransitions: Record<ProjectStatus, ProjectStatus[]> = {
  planning: ['in_progress', 'on_hold', 'cancelled', 'completed'],
  in_progress: ['on_hold', 'completed', 'cancelled'],
  on_hold: ['in_progress', 'cancelled', 'completed'],
  completed: [],
  cancelled: ['planning'],
};

export function canTransitionProjectStatus(
  from: ProjectStatus,
  to: ProjectStatus,
): boolean {
  if (from === to) return true;
  return allowedTransitions[from]?.includes(to) ?? false;
}

export function permittedNextStatuses(from: ProjectStatus): ProjectStatus[] {
  return [...(allowedTransitions[from] ?? [])];
}
