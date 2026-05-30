import { z } from "zod";

export const PAYMENT_METHOD_PRESETS = [
  "cash",
  "kbz_banking",
  "kbz_pay",
  "aya_banking",
  "aya_pay",
  "cb_banking",
  "cb_pay",
  "wave_pay",
] as const;

export type PaymentMethodPreset = (typeof PAYMENT_METHOD_PRESETS)[number];

export const paymentMethodPresetSchema = z.enum(PAYMENT_METHOD_PRESETS);

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodPreset, string> = {
  cash: "Cash",
  kbz_banking: "KBZ Banking",
  kbz_pay: "KBZ Pay",
  aya_banking: "AYA Banking",
  aya_pay: "AYA Pay",
  cb_banking: "CB Banking",
  cb_pay: "CB Pay",
  wave_pay: "Wave Pay",
};

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
