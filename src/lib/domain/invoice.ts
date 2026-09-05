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

/** Badge tone classes per invoice status (mirrors quotation STATUS_CONFIG styling). */
export const INVOICE_STATUS_BADGE_TONES: Record<ProjectInvoiceStatus, string> = {
  draft: "border-slate-500/35 bg-slate-500/10 text-slate-400",
  unpaid: "border-amber-500/45 bg-amber-500/10 text-amber-300",
  partial: "border-indigo-500/45 bg-indigo-500/10 text-indigo-300",
  paid: "border-emerald-500/45 bg-emerald-500/10 text-emerald-300",
  voided: "border-zinc-500/40 bg-zinc-500/10 text-zinc-400",
};

/** Statuses that represent money still owed on a posted invoice. */
export const OPEN_INVOICE_STATUSES = [
  "unpaid",
  "partial",
] as const satisfies readonly ProjectInvoiceStatus[];

export function isOpenInvoiceStatus(status: ProjectInvoiceStatus): boolean {
  return (OPEN_INVOICE_STATUSES as readonly string[]).includes(status);
}

/**
 * An invoice is overdue when it is posted and still open (unpaid/partial)
 * and its due date is before the start of today. Drafts are not yet owed;
 * paid/voided invoices can never be overdue.
 */
export function isInvoiceOverdue(
  status: ProjectInvoiceStatus,
  dueDate: Date,
  now: Date = new Date(),
): boolean {
  if (!isOpenInvoiceStatus(status)) return false;
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  return dueDate.getTime() < startOfToday.getTime();
}

export function canPostInvoice(status: ProjectInvoiceStatus): boolean {
  return status === "draft";
}

export function canVoidInvoice(status: ProjectInvoiceStatus): boolean {
  return status === "draft" || status === "unpaid";
}
