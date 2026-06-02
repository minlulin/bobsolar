/**
 * Myanmar Tax Rules SSoT
 *
 * Defines commercial tax and withholding tax rates according to Myanmar tax laws.
 */

export const MYANMAR_TAX = {
  COMMERCIAL_TAX_RATE: 5, // 5% Commercial Tax
  WITHHOLDING_TAX_RATES: {
    RESIDENT: 2, // 2% for resident citizens/companies
    NON_RESIDENT: 2.5, // 2.5% for non-resident foreigners
  },
} as const;

/**
 * Calculates the commercial tax amount based on the subtotal.
 */
export function calculateCommercialTax(
  subtotal: number,
  taxRate: number = MYANMAR_TAX.COMMERCIAL_TAX_RATE,
): number {
  return Math.round(subtotal * (taxRate / 100));
}

/**
 * Calculates the withholding tax amount based on the subtotal and residency status.
 */
export function calculateWithholdingTax(subtotal: number, isResident: boolean = true): number {
  const rate = isResident
    ? MYANMAR_TAX.WITHHOLDING_TAX_RATES.RESIDENT
    : MYANMAR_TAX.WITHHOLDING_TAX_RATES.NON_RESIDENT;
  return Math.round(subtotal * (rate / 100));
}
