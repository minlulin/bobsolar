import { z } from "zod";
import { purchaseOrderStatusEnum, supplierPaymentStatusEnum } from "../db/schema";

export const PURCHASE_ORDER_STATUSES = purchaseOrderStatusEnum.enumValues;
export const SUPPLIER_PAYMENT_STATUSES = supplierPaymentStatusEnum.enumValues;

export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number];
export type SupplierPaymentStatus = (typeof SUPPLIER_PAYMENT_STATUSES)[number];

export const purchaseOrderStatusSchema = z.enum(PURCHASE_ORDER_STATUSES);
export const supplierPaymentStatusSchema = z.enum(SUPPLIER_PAYMENT_STATUSES);

export const PURCHASE_ORDER_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  draft: "Draft",
  received: "Received",
  cancelled: "Cancelled",
};

export const SUPPLIER_PAYMENT_STATUS_LABELS: Record<SupplierPaymentStatus, string> = {
  unpaid: "Unpaid",
  partial: "Partial",
  paid: "Paid",
};

export function isPurchaseOrderStatus(value: string): value is PurchaseOrderStatus {
  return (PURCHASE_ORDER_STATUSES as readonly string[]).includes(value);
}

export function isSupplierPaymentStatus(value: string): value is SupplierPaymentStatus {
  return (SUPPLIER_PAYMENT_STATUSES as readonly string[]).includes(value);
}
