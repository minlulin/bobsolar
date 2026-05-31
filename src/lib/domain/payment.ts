import { z } from "zod";
import type { LedgerAccountCode } from "@/lib/domain/finance";

/**
 * Payment Method Presets SSoT
 * Myanmar-local payment methods. Currency is MMK (no cents).
 *
 * Wallet methods: customer pays via mobile wallet app (KBZPay, AYA Pay, CB Pay, WavePay)
 * Bank methods: customer pays via direct bank account transfer
 */
export const PAYMENT_METHOD_PRESETS = [
  "cash",
  "kbz_pay",
  "kbz_banking",
  "aya_pay",
  "aya_banking",
  "cb_pay",
  "cb_banking",
  "wave_pay",
] as const;

export type PaymentMethodPreset = (typeof PAYMENT_METHOD_PRESETS)[number];

export const paymentMethodPresetSchema = z.enum(PAYMENT_METHOD_PRESETS);

/** Maps each payment method preset to its ledger asset account code. */
export const PAYMENT_METHOD_LEDGER_MAP: Record<PaymentMethodPreset, LedgerAccountCode> = {
  cash: "cash_on_hand",
  kbz_pay: "kbz_wallet",
  kbz_banking: "kbz_banking",
  aya_pay: "aya_wallet",
  aya_banking: "aya_banking",
  cb_pay: "cb_wallet",
  cb_banking: "cb_banking",
  wave_pay: "wave_wallet",
} as const;

/** Display labels for payment methods. */
export const PAYMENT_METHOD_LABELS: Record<PaymentMethodPreset, string> = {
  cash: "Cash",
  kbz_pay: "KBZPay",
  kbz_banking: "KBZ Bank Transfer",
  aya_pay: "AYA Pay",
  aya_banking: "AYA Bank Transfer",
  cb_pay: "CB Pay",
  cb_banking: "CB Bank Transfer",
  wave_pay: "WavePay",
};

/** Resolve a payment method name to its ledger asset account code. */
export function mapPaymentMethodToAccount(methodName: string): LedgerAccountCode {
  const normalized = methodName.trim().toLowerCase().replaceAll(/[- ]/g, "_");
  if (normalized in PAYMENT_METHOD_LEDGER_MAP) {
    return PAYMENT_METHOD_LEDGER_MAP[normalized as PaymentMethodPreset];
  }
  throw new Error(`Unknown payment method: ${methodName}`);
}

export const PAYMENT_COLLECTION_STATUSES = ["advance", "partial", "fully_paid"] as const;

export type PaymentCollectionStatus = (typeof PAYMENT_COLLECTION_STATUSES)[number];

export const paymentCollectionStatusSchema = z.enum(PAYMENT_COLLECTION_STATUSES);

export const PAYMENT_COLLECTION_STATUS_LABELS: Record<PaymentCollectionStatus, string> = {
  advance: "Advance",
  partial: "Partial Payment",
  fully_paid: "Fully Paid",
};

export const PAYMENT_TYPES = ["advance", "final"] as const;

export type PaymentType = (typeof PAYMENT_TYPES)[number];

export const paymentTypeSchema = z.enum(PAYMENT_TYPES);

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  advance: "Advance",
  final: "Final",
};
