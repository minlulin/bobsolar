import { z } from 'zod';
import { quotationStatusEnum } from '@/lib/db/schema';

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
