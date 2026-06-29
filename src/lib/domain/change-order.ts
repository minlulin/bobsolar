import { z } from "zod";
import { type ChangeOrderStatus, changeOrderStatusEnum } from "@/lib/db/schema";

export const CHANGE_ORDER_STATUSES = changeOrderStatusEnum.enumValues;

export const changeOrderStatusSchema = z.enum(CHANGE_ORDER_STATUSES);

/** Type guard for ChangeOrderStatus */
export function isChangeOrderStatus(status: string): status is ChangeOrderStatus {
  return CHANGE_ORDER_STATUSES.includes(status as ChangeOrderStatus);
}

/** UI label map for change order statuses */
export const CHANGE_ORDER_STATUS_LABELS: Record<ChangeOrderStatus, string> = {
  draft: "Draft",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

/**
 * Allowed status transitions for change orders:
 *   draft → approved | rejected
 *   approved → cancelled
 *   rejected → (terminal)
 *   cancelled → (terminal)
 */
export const CHANGE_ORDER_STATUS_TRANSITIONS: Record<ChangeOrderStatus, ChangeOrderStatus[]> = {
  draft: ["approved", "rejected"],
  approved: ["cancelled"],
  rejected: [],
  cancelled: [],
};

/** Check if a change order status transition is valid */
export function canTransitionChangeOrderStatus(
  from: ChangeOrderStatus,
  to: ChangeOrderStatus,
): boolean {
  if (from === to) return true;
  return CHANGE_ORDER_STATUS_TRANSITIONS[from].includes(to);
}

/** Get list of permitted next statuses from current status */
export function permittedNextChangeOrderStatuses(from: ChangeOrderStatus): ChangeOrderStatus[] {
  return [...CHANGE_ORDER_STATUS_TRANSITIONS[from]];
}
