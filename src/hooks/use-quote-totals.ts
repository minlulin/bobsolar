import { useMemo } from "react";
import { calculateQuotation, type PricingResult } from "@/lib/pricing/engine";
import { useQuoteBuilderStore } from "@/stores/quote-builder-store";

/**
 * Memoized derived selector for quotation totals.
 *
 * Replaces the old `getTotals()` anti-pattern that caused full-store re-renders.
 * Only recalculates when `items`, `discountPercent`, or `taxPercent` change.
 */
export function useQuoteTotals(): PricingResult {
  const items = useQuoteBuilderStore((s) => s.items);
  const discountPercent = useQuoteBuilderStore((s) => s.discountPercent);
  const taxPercent = useQuoteBuilderStore((s) => s.taxPercent);

  return useMemo(
    () => calculateQuotation(items, discountPercent, taxPercent),
    [items, discountPercent, taxPercent],
  );
}
