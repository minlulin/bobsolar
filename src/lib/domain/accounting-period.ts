import { z } from "zod";
import { accountingPeriodStatusEnum } from "@/lib/db/schema";

export const ACCOUNTING_PERIOD_STATUSES = accountingPeriodStatusEnum.enumValues;
export type AccountingPeriodStatus = (typeof ACCOUNTING_PERIOD_STATUSES)[number];
export const accountingPeriodStatusSchema = z.enum(ACCOUNTING_PERIOD_STATUSES);

export const ACCOUNTING_PERIOD_STATUS_LABELS: Record<AccountingPeriodStatus, string> = {
  open: "Open",
  soft_closed: "Soft Closed",
  closed: "Closed",
};

export function canClosePeriod(status: AccountingPeriodStatus): boolean {
  return status === "open" || status === "soft_closed";
}

export function canReopenPeriod(status: AccountingPeriodStatus): boolean {
  return status === "soft_closed";
}
