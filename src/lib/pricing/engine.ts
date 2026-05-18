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
  return Math.round(calculateLineItemPrecise(item));
}

function calculateLineItemPrecise(item: LineItem): number {
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
  // 1. Use rounded line-item totals so the grand total matches
  //    the sum of displayed line items (avoids ±1 MMK drift).
  const subtotal = items.reduce((sum, item) => sum + calculateLineItem(item), 0);

  // 2. Apply global discount and tax on precise values.
  const discountAmount = subtotal * (globalDiscountPercentage / 100);
  const afterDiscount = subtotal - discountAmount;

  // 3. Round only at output boundaries.
  const roundedSubtotal = Math.round(subtotal);
  const roundedDiscountAmount = Math.round(discountAmount);
  const taxAmount = Math.round(afterDiscount * (taxPercentage / 100));

  // 4. Final total is integer MMK.
  const total = roundedSubtotal - roundedDiscountAmount + taxAmount;

  return {
    subtotal: roundedSubtotal,
    discountAmount: roundedDiscountAmount,
    taxAmount,
    total,
  };
}
