import { z } from 'zod';

export const PAYMENT_METHOD_PRESETS = [
  'cash',
  'bank_transfer',
  'mobile_wallet',
  'cheque',
  'other',
] as const;

export type PaymentMethodPreset = (typeof PAYMENT_METHOD_PRESETS)[number];

export const paymentMethodPresetSchema = z.enum(PAYMENT_METHOD_PRESETS);

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodPreset, string> = {
  cash: 'Cash',
  bank_transfer: 'Bank Transfer',
  mobile_wallet: 'Mobile Wallet',
  cheque: 'Cheque',
  other: 'Other',
};
