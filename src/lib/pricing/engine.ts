/**
 * Pricing Engine for BOB Solar
 * Handles calculations for line items, subtotals, discounts, and tax.
 */

export interface LineItem {
  quantity: number;
  unitPrice: number;
  discountPercentage?: number;
}

export interface PricingResult {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
}

export function calculateLineItem(item: LineItem): number {
  const { quantity, unitPrice, discountPercentage = 0 } = item;
  const basePrice = quantity * unitPrice;
  const discount = basePrice * (discountPercentage / 100);
  return Math.round(basePrice - discount);
}

export function calculateQuotation(
  items: LineItem[],
  globalDiscountPercentage: number = 0,
  taxPercentage: number = 0,
): PricingResult {
  // 1. Calculate sum of line items (already rounded to int)
  const subtotal = items.reduce(
    (sum, item) => sum + calculateLineItem(item),
    0,
  );

  // 2. Apply global discount and round
  const discountAmount = Math.round(
    subtotal * (globalDiscountPercentage / 100),
  );
  const afterDiscount = subtotal - discountAmount;

  // 3. Apply tax (Commercial Tax) and round
  const taxAmount = Math.round(afterDiscount * (taxPercentage / 100));

  // 4. Final total
  const total = afterDiscount + taxAmount;

  return {
    subtotal,
    discountAmount,
    taxAmount,
    total,
  };
}
