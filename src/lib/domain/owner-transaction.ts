import { z } from "zod";
import { ownerTransactionStatusEnum, ownerTransactionTypeEnum } from "@/lib/db/schema";

export const OWNER_TRANSACTION_TYPES = ownerTransactionTypeEnum.enumValues;
export type OwnerTransactionType = (typeof OWNER_TRANSACTION_TYPES)[number];
export const ownerTransactionTypeSchema = z.enum(OWNER_TRANSACTION_TYPES);

export const OWNER_TRANSACTION_STATUSES = ownerTransactionStatusEnum.enumValues;
export type OwnerTransactionStatus = (typeof OWNER_TRANSACTION_STATUSES)[number];
export const ownerTransactionStatusSchema = z.enum(OWNER_TRANSACTION_STATUSES);

export const OWNER_TX_TYPES = {
  DISTRIBUTION: "distribution",
  DRAW: "draw",
  CAPITAL_CALL_ISSUED: "capital_call_issued",
  CAPITAL_CONTRIBUTION: "capital_contribution",
} as const;

export const OWNER_TX_STATUSES = {
  PENDING: "pending",
  COMPLETED: "completed",
} as const;

export const OWNER_TRANSACTION_TYPE_LABELS: Record<OwnerTransactionType, string> = {
  distribution: "Distribution",
  draw: "Owner Draw",
  capital_call_issued: "Capital Call Issued",
  capital_contribution: "Capital Contribution",
};

export const OWNER_TRANSACTION_STATUS_LABELS: Record<OwnerTransactionStatus, string> = {
  pending: "Pending",
  completed: "Completed",
};

export function isOwnerTransactionType(value: string): value is OwnerTransactionType {
  return (OWNER_TRANSACTION_TYPES as readonly string[]).includes(value);
}

export function isOwnerTransactionStatus(value: string): value is OwnerTransactionStatus {
  return (OWNER_TRANSACTION_STATUSES as readonly string[]).includes(value);
}
