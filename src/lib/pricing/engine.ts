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
  return basePrice - discount;
}

export function calculateQuotation(
  items: LineItem[],
  globalDiscountPercentage: number = 0,
  taxPercentage: number = 0,
): PricingResult {
  // 1. Calculate sum of line items
  const subtotal = items.reduce(
    (sum, item) => sum + calculateLineItem(item),
    0,
  );

  // 2. Apply global discount
  const discountAmount = subtotal * (globalDiscountPercentage / 100);
  const afterDiscount = subtotal - discountAmount;

  // 3. Apply tax (Commercial Tax)
  const taxAmount = afterDiscount * (taxPercentage / 100);

  // 4. Final total
  const total = afterDiscount + taxAmount;

  return {
    subtotal,
    discountAmount,
    taxAmount,
    total,
  };
}

export function formatMMK(amount: number): string {
  return (
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'MMK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
      .format(amount)
      .replace('MMK', '')
      .trim() + ' MMK'
  );
}
