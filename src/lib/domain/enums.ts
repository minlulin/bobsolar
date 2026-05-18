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
  ALERT_TYPE_LABELS,
  ALERT_TYPES,
  type AlertType,
  alertTypeSchema,
} from "@/lib/domain/alert-types";
export {
  COST_FILTERS,
  COST_TYPE_LABELS,
  COST_TYPES,
  type CostFilter,
  type CostType,
  costTypeSchema,
} from "@/lib/domain/cost-types";
export {
  FINANCE_TRANSACTION_TYPES,
  type FinanceTransactionType,
  financeTransactionTypeSchema,
  JOURNAL_SOURCE_TYPES,
  type JournalSourceType,
  journalSourceTypeSchema,
  LEDGER_ACCOUNT_CODE_TYPE_MAP,
  LEDGER_ACCOUNT_CODES,
  LEDGER_ACCOUNT_LABELS,
  LEDGER_ACCOUNT_TYPES,
  type LedgerAccountCode,
  type LedgerAccountType,
  ledgerAccountCodeSchema,
  ledgerAccountTypeSchema,
  PROJECT_EXPENSE_TYPES,
  type ProjectExpenseType,
  projectExpenseTypeSchema,
} from "@/lib/domain/finance";
export {
  INVENTORY_CATEGORIES,
  INVENTORY_UNITS,
  type InventoryCategory,
  type InventoryUnit,
  inventoryCategorySchema,
  inventoryUnitSchema,
} from "@/lib/domain/inventory";
export {
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_TYPES,
  type NotificationType,
  notificationTypeSchema,
} from "@/lib/domain/notification-types";
export {
  PAYMENT_COLLECTION_STATUS_LABELS,
  PAYMENT_COLLECTION_STATUSES,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_PRESETS,
  type PaymentCollectionStatus,
  type PaymentMethodPreset,
  paymentCollectionStatusSchema,
  paymentMethodPresetSchema,
} from "@/lib/domain/payment";
export {
  canTransitionProjectStatus,
  isProjectStatus,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_TRANSITIONS,
  PROJECT_STATUSES,
  type ProjectStatus,
  permittedNextStatuses,
  projectStatusSchema,
} from "@/lib/domain/project";
export {
  canTransitionQuotationStatus,
  isQuotationStatus,
  QUOTATION_STATUS_LABELS,
  QUOTATION_STATUS_TRANSITIONS,
  QUOTATION_STATUSES,
  type QuotationStatus,
  quotationStatusSchema,
} from "@/lib/domain/quotation";
export {
  REMARK_TYPE_ICONS,
  REMARK_TYPE_LABELS,
  REMARK_TYPES,
  type RemarkType,
  remarkTypeSchema,
} from "@/lib/domain/remark-types";
export {
  USER_ROLES,
  type UserRole,
  userRoleSchema,
} from "@/lib/domain/user-roles";
