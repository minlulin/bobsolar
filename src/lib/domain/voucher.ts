import { z } from 'zod';
import { voucherTypeEnum } from '@/lib/db/schema';

export const VOUCHER_TYPES = voucherTypeEnum.enumValues;
export type VoucherType = (typeof voucherTypeEnum.enumValues)[number];
export const voucherTypeSchema = z.enum(VOUCHER_TYPES);

export const VOUCHER_TYPE_LABELS: Record<VoucherType, string> = {
  completion_certificate: 'Completion Certificate',
  final_payment_voucher: 'Final Payment Voucher',
};
