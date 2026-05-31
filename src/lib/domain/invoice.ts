import { z } from "zod";
import { type ProjectInvoiceStatus, projectInvoiceStatusEnum } from "@/lib/db/schema";

export type { ProjectInvoiceStatus } from "@/lib/db/schema";
export const PROJECT_INVOICE_STATUSES = projectInvoiceStatusEnum.enumValues;
export const projectInvoiceStatusSchema = z.enum(PROJECT_INVOICE_STATUSES);

export const INVOICE_STATUS_LABELS: Record<ProjectInvoiceStatus, string> = {
  draft: "Draft",
  unpaid: "Unpaid",
  partial: "Partially Paid",
  paid: "Paid",
  voided: "Voided",
};

export function canPostInvoice(status: ProjectInvoiceStatus): boolean {
  return status === "draft";
}

export function canVoidInvoice(status: ProjectInvoiceStatus): boolean {
  return status === "draft" || status === "unpaid";
}
