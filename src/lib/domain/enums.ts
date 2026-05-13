import { z } from 'zod';
import {
  userRoleEnum,
  inventoryCategoryEnum,
  inventoryUnitEnum,
  quotationStatusEnum,
  projectStatusEnum,
  costTypeEnum,
  remarkTypeEnum,
  alertTypeEnum,
  notificationTypeEnum,
} from '@/lib/db/schema';

// =============================================================================
// USER ROLES
// =============================================================================

export const USER_ROLES = userRoleEnum.enumValues;
export type UserRole = (typeof userRoleEnum.enumValues)[number];
export const userRoleSchema = z.enum(USER_ROLES);

// =============================================================================
// INVENTORY CATEGORIES & UNITS
// =============================================================================

export const INVENTORY_CATEGORIES = inventoryCategoryEnum.enumValues;
export type InventoryCategory =
  (typeof inventoryCategoryEnum.enumValues)[number];
export const inventoryCategorySchema = z.enum(INVENTORY_CATEGORIES);

export const INVENTORY_UNITS = inventoryUnitEnum.enumValues;
export type InventoryUnit = (typeof inventoryUnitEnum.enumValues)[number];
export const inventoryUnitSchema = z.enum(INVENTORY_UNITS);

// =============================================================================
// QUOTATION STATUS
// =============================================================================

export const QUOTATION_STATUSES = quotationStatusEnum.enumValues;
export type QuotationStatus = (typeof quotationStatusEnum.enumValues)[number];
export const quotationStatusSchema = z.enum(QUOTATION_STATUSES);

/** Type guard for QuotationStatus */
export function isQuotationStatus(status: string): status is QuotationStatus {
  return QUOTATION_STATUSES.includes(status as QuotationStatus);
}

/** UI label map for quotation statuses */
export const QUOTATION_STATUS_LABELS: Record<QuotationStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  accepted: 'Accepted',
  rejected: 'Rejected',
  expired: 'Expired',
};

/** Allowed status transitions for quotations */
export const QUOTATION_STATUS_TRANSITIONS: Record<
  QuotationStatus,
  QuotationStatus[]
> = {
  draft: ['sent', 'draft'],
  sent: ['accepted', 'rejected', 'expired', 'draft'],
  accepted: ['draft', 'rejected'],
  rejected: ['draft'],
  expired: ['draft'],
};

/** Check if a quotation status transition is valid */
export function canTransitionQuotationStatus(
  currentStatus: QuotationStatus,
  newStatus: QuotationStatus,
): boolean {
  const allowed = QUOTATION_STATUS_TRANSITIONS[currentStatus];
  return allowed.includes(newStatus);
}

// =============================================================================
// PROJECT STATUS
// =============================================================================

export const PROJECT_STATUSES = projectStatusEnum.enumValues;
export type ProjectStatus = (typeof projectStatusEnum.enumValues)[number];
export const projectStatusSchema = z.enum(PROJECT_STATUSES);

/** Type guard for ProjectStatus */
export function isProjectStatus(status: string): status is ProjectStatus {
  return PROJECT_STATUSES.includes(status as ProjectStatus);
}

/** UI label map for project statuses */
export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: 'Planning',
  in_progress: 'In Progress',
  on_hold: 'On Hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

/** Allowed status transitions for projects */
export const PROJECT_STATUS_TRANSITIONS: Record<
  ProjectStatus,
  ProjectStatus[]
> = {
  planning: ['in_progress', 'on_hold', 'cancelled', 'completed'],
  in_progress: ['on_hold', 'completed', 'cancelled'],
  on_hold: ['in_progress', 'cancelled', 'completed'],
  completed: [],
  cancelled: ['planning'],
};

/** Check if a project status transition is valid */
export function canTransitionProjectStatus(
  from: ProjectStatus,
  to: ProjectStatus,
): boolean {
  if (from === to) return true;
  return PROJECT_STATUS_TRANSITIONS[from].includes(to);
}

/** Get list of permitted next statuses from current status */
export function permittedNextStatuses(from: ProjectStatus): ProjectStatus[] {
  return [...PROJECT_STATUS_TRANSITIONS[from]];
}

// =============================================================================
// COST TYPES
// =============================================================================

export const COST_TYPES = costTypeEnum.enumValues;
export type CostType = (typeof costTypeEnum.enumValues)[number];
export const costTypeSchema = z.enum(COST_TYPES);

/** UI label map for cost types */
export const COST_TYPE_LABELS: Record<CostType, string> = {
  material: 'Materials',
  labor: 'Labor',
  transport: 'Logistics',
  misc: 'Miscellaneous',
};

// =============================================================================
// REMARK TYPES
// =============================================================================

export const REMARK_TYPES = remarkTypeEnum.enumValues;
export type RemarkType = (typeof remarkTypeEnum.enumValues)[number];
export const remarkTypeSchema = z.enum(REMARK_TYPES);

/** Icon map for remark types */
export const REMARK_TYPE_ICONS: Record<RemarkType, string> = {
  note: '🗒️',
  issue: '🚩',
  update: '📣',
};

/** UI label map for remark types */
export const REMARK_TYPE_LABELS: Record<RemarkType, string> = {
  note: 'Field Note',
  issue: 'Site Issue',
  update: 'Stakeholder Update',
};

// =============================================================================
// ALERT TYPES
// =============================================================================

export const ALERT_TYPES = alertTypeEnum.enumValues;
export type AlertType = (typeof alertTypeEnum.enumValues)[number];
export const alertTypeSchema = z.enum(ALERT_TYPES);

/** UI label map for alert types */
export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  warranty_expiry: 'Warranty Expiry',
  maintenance_due: 'Preventive Upkeep',
  follow_up: 'Client Follow-through',
};

// =============================================================================
// NOTIFICATION TYPES
// =============================================================================

export const NOTIFICATION_TYPES = notificationTypeEnum.enumValues;
export type NotificationType = (typeof notificationTypeEnum.enumValues)[number];
export const notificationTypeSchema = z.enum(NOTIFICATION_TYPES);

/** UI label map for notification types */
export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  info: 'Information',
  warning: 'Warning',
  action: 'Action Required',
};

// =============================================================================
// COST FILTERS (UI-specific composite type)
// =============================================================================

export const COST_FILTERS = ['all', ...COST_TYPES] as const;
export type CostFilter = (typeof COST_FILTERS)[number];
