/**
 * Barrel file for domain enums.
 *
 * Re-exports from domain-specific modules for backward compatibility.
 * New code should import directly from the domain-specific file when needed.
 *
 * @example
 * ```ts
 * // Barrel import (backward compatible, existing code)
 * import { QuotationStatus, UserRole } from '@/lib/domain/enums';
 *
 * // Targeted import (preferred for new code)
 * import { QuotationStatus } from '@/lib/domain/quotation';
 * ```
 */

export {
  USER_ROLES,
  userRoleSchema,
  type UserRole,
} from '@/lib/domain/user-roles';

export {
  INVENTORY_CATEGORIES,
  INVENTORY_UNITS,
  inventoryCategorySchema,
  inventoryUnitSchema,
  type InventoryCategory,
  type InventoryUnit,
} from '@/lib/domain/inventory';

export {
  QUOTATION_STATUSES,
  QUOTATION_STATUS_LABELS,
  QUOTATION_STATUS_TRANSITIONS,
  quotationStatusSchema,
  canTransitionQuotationStatus,
  isQuotationStatus,
  type QuotationStatus,
} from '@/lib/domain/quotation';

export {
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_TRANSITIONS,
  projectStatusSchema,
  canTransitionProjectStatus,
  permittedNextStatuses,
  isProjectStatus,
  type ProjectStatus,
} from '@/lib/domain/project';

export {
  COST_TYPES,
  COST_FILTERS,
  COST_TYPE_LABELS,
  costTypeSchema,
  type CostFilter,
  type CostType,
} from '@/lib/domain/cost-types';

export {
  REMARK_TYPES,
  REMARK_TYPE_ICONS,
  REMARK_TYPE_LABELS,
  remarkTypeSchema,
  type RemarkType,
} from '@/lib/domain/remark-types';

export {
  ALERT_TYPES,
  ALERT_TYPE_LABELS,
  alertTypeSchema,
  type AlertType,
} from '@/lib/domain/alert-types';

export {
  NOTIFICATION_TYPES,
  NOTIFICATION_TYPE_LABELS,
  notificationTypeSchema,
  type NotificationType,
} from '@/lib/domain/notification-types';
