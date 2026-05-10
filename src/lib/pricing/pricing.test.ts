import { describe, expect, it } from 'vitest';
import {
  calculateLineItem,
  calculateQuotation,
  type LineItem,
} from './engine';
import { formatMMK } from '@/lib/utils';

describe('pricing', () => {
  it('calculates line item with discount', () => {
    const item: LineItem = {
      quantity: 2,
      unitPrice: 1000,
      discountPercentage: 10,
    };
    expect(calculateLineItem(item)).toBe(1800);
  });

  it('calculates quotation totals', () => {
    const items: LineItem[] = [{ quantity: 1, unitPrice: 1000 }];
    const result = calculateQuotation(items, 20, 10);
    expect(result.subtotal).toBe(1000);
    expect(result.discountAmount).toBe(200);
    expect(result.taxAmount).toBe(80);
    expect(result.total).toBe(880);
  });

  it('formats MMK values', () => {
    expect(formatMMK(1500000)).toBe('1,500,000 MMK');
  });
});
