/**
 * Pricing Engine for BOB Solar
 * Handles calculations for line items, subtotals, discounts, and tax.
 */

export type LineItem = {
  quantity: number;
  unitPrice: number;
  discountPercentage?: number;
};

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
  // Keep quotation math integer-MMK aligned with displayed line items.
  // Each line item is already rounded; subtotal is their exact displayed sum.
  const subtotal = items.reduce((sum, item) => sum + calculateLineItem(item), 0);

  const discountAmount = Math.round(subtotal * (globalDiscountPercentage / 100));
  const taxableBase = subtotal - discountAmount;
  const taxAmount = Math.round(taxableBase * (taxPercentage / 100));
  const total = subtotal - discountAmount + taxAmount;

  return {
    subtotal,
    discountAmount,
    taxAmount,
    total,
  };
}
