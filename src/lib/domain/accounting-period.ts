import { z } from "zod";
import { type AccountingPeriodStatus, accountingPeriodStatusEnum } from "@/lib/db/schema";

export type { AccountingPeriodStatus } from "@/lib/db/schema";
export const ACCOUNTING_PERIOD_STATUSES = accountingPeriodStatusEnum.enumValues;
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
