import { describe, it, expect } from 'vitest';
import { calculateLineItem, calculateQuotation, type LineItem } from './engine';
import { formatMMK } from '@/lib/utils';

describe('calculateLineItem', () => {
  it('calculates basic line item', () => {
    const item: LineItem = { quantity: 2, unitPrice: 1000 };
    expect(calculateLineItem(item)).toBe(2000);
  });

  it('calculates with discount', () => {
    const item: LineItem = {
      quantity: 2,
      unitPrice: 1000,
      discountPercentage: 10,
    };
    expect(calculateLineItem(item)).toBe(1800);
  });

  it('handles zero quantity', () => {
    const item: LineItem = { quantity: 0, unitPrice: 1000 };
    expect(calculateLineItem(item)).toBe(0);
  });

  it('handles zero price', () => {
    const item: LineItem = { quantity: 5, unitPrice: 0 };
    expect(calculateLineItem(item)).toBe(0);
  });
});

describe('calculateQuotation', () => {
  it('calculates basic quotation', () => {
    const items: LineItem[] = [
      { quantity: 1, unitPrice: 1000 },
      { quantity: 2, unitPrice: 500 },
    ];
    const result = calculateQuotation(items, 0, 0);
    expect(result.subtotal).toBe(2000);
    expect(result.discountAmount).toBe(0);
    expect(result.taxAmount).toBe(0);
    expect(result.total).toBe(2000);
  });

  it('calculates with discount', () => {
    const items: LineItem[] = [{ quantity: 1, unitPrice: 1000 }];
    const result = calculateQuotation(items, 10, 0);
    expect(result.subtotal).toBe(1000);
    expect(result.discountAmount).toBe(100);
    expect(result.total).toBe(900);
  });

  it('calculates with tax', () => {
    const items: LineItem[] = [{ quantity: 1, unitPrice: 1000 }];
    const result = calculateQuotation(items, 0, 10);
    expect(result.subtotal).toBe(1000);
    expect(result.taxAmount).toBe(100);
    expect(result.total).toBe(1100);
  });

  it('calculates with discount and tax', () => {
    const items: LineItem[] = [{ quantity: 1, unitPrice: 1000 }];
    const result = calculateQuotation(items, 20, 10);
    expect(result.subtotal).toBe(1000);
    expect(result.discountAmount).toBe(200);
    expect(result.taxAmount).toBe(80); // 800 * 10%
    expect(result.total).toBe(880);
  });

  it('handles zero items', () => {
    const items: LineItem[] = [];
    const result = calculateQuotation(items, 10, 10);
    expect(result.subtotal).toBe(0);
    expect(result.discountAmount).toBe(0);
    expect(result.taxAmount).toBe(0);
    expect(result.total).toBe(0);
  });

  it('handles large numbers (millions of MMK)', () => {
    const items: LineItem[] = [{ quantity: 100, unitPrice: 15000000 }];
    const result = calculateQuotation(items, 5, 5);
    expect(result.subtotal).toBe(1500000000);
    expect(result.discountAmount).toBe(75000000);
    expect(result.taxAmount).toBe(71250000); // (1500000000 - 75000000) * 5%
    expect(result.total).toBe(1500000000 + 71250000 - 75000000);
  });
});

describe('formatMMK', () => {
  it('formats basic amount', () => {
    expect(formatMMK(1500000)).toBe('1,500,000 MMK');
  });

  it('formats zero', () => {
    expect(formatMMK(0)).toBe('0 MMK');
  });

  it('formats small amount', () => {
    expect(formatMMK(100)).toBe('100 MMK');
  });
});
