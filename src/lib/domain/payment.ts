import { z } from "zod";

export const PAYMENT_METHOD_PRESETS = [
  "cash",
  "kbz_pay",
  "wave_pay",
  "aya_pay",
  "bank_transfer",
] as const;

export type PaymentMethodPreset = (typeof PAYMENT_METHOD_PRESETS)[number];

export const paymentMethodPresetSchema = z.enum(PAYMENT_METHOD_PRESETS);

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodPreset, string> = {
  cash: "Cash",
  kbz_pay: "KBZ Pay",
  wave_pay: "Wave Pay",
  aya_pay: "AYA Pay",
  bank_transfer: "Bank Transfer",
};

export const PAYMENT_COLLECTION_STATUSES = ["advance", "partial", "fully_paid"] as const;

export type PaymentCollectionStatus = (typeof PAYMENT_COLLECTION_STATUSES)[number];

export const paymentCollectionStatusSchema = z.enum(PAYMENT_COLLECTION_STATUSES);

export const PAYMENT_COLLECTION_STATUS_LABELS: Record<PaymentCollectionStatus, string> = {
  advance: "Advance",
  partial: "Partial Payment",
  fully_paid: "Fully Paid",
};
