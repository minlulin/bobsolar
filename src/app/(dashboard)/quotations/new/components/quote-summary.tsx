'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useQuoteBuilderStore } from '@/stores/quote-builder-store';
import { formatMMK } from '@/lib/utils';
import { Calendar as CalendarIcon, Percent } from 'lucide-react';

export function QuoteSummary(): React.JSX.Element {
  const {
    discountPercent,
    taxPercent,
    notes,
    validUntil,
    setDiscount,
    setTax,
    setNotes,
    setValidUntil,
    getTotals,
  } = useQuoteBuilderStore();
  const [discountInput, setDiscountInput] = React.useState<string>(
    String(discountPercent),
  );
  const [taxInput, setTaxInput] = React.useState<string>(String(taxPercent));
  const [isDiscountEditing, setIsDiscountEditing] = React.useState(false);
  const [isTaxEditing, setIsTaxEditing] = React.useState(false);

  const totals = getTotals();

  return (
    <div className="border-border/60 grid grid-cols-1 gap-8 border-t pt-6 md:grid-cols-2">
      {/* Left: Notes and Expiry */}
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-muted-foreground ml-1 text-sm font-medium">
            Additional Notes
          </label>
          <Textarea
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
            }}
            placeholder="Terms, bank details, or special instructions..."
            className="border-border/70 bg-muted/35 min-h-[120px] resize-none transition-all focus:border-amber-500/50"
          />
        </div>

        <div className="space-y-2">
          <label className="text-muted-foreground ml-1 text-sm font-medium">
            Valid Until
          </label>
          <div className="relative">
            <CalendarIcon className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              type="date"
              value={validUntil ? validUntil.toISOString().split('T')[0] : ''}
              onChange={(e) => {
                setValidUntil(e.target.value ? new Date(e.target.value) : null);
              }}
              className="border-border/70 bg-muted/35 pl-10 transition-all focus:border-amber-500/50"
            />
          </div>
        </div>
      </div>

      {/* Right: Totals Calculation */}
      <div className="border-border/60 bg-muted/35 space-y-4 rounded-2xl border p-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-mono font-bold">
              {formatMMK(totals.subtotal)}
            </span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Discount</span>
              <div className="relative w-16">
                <Percent className="text-muted-foreground absolute top-1/2 right-2 h-3 w-3 -translate-y-1/2" />
                <Input
                  type="number"
                  value={
                    isDiscountEditing ? discountInput : String(discountPercent)
                  }
                  onFocus={() => {
                    setIsDiscountEditing(true);
                    setDiscountInput(String(discountPercent));
                  }}
                  onChange={(e) => {
                    setDiscountInput(e.target.value);
                  }}
                  onBlur={() => {
                    const parsed = Number.parseFloat(discountInput);
                    const normalized = Number.isFinite(parsed)
                      ? Math.min(100, Math.max(0, parsed))
                      : discountPercent;
                    setIsDiscountEditing(false);
                    setDiscount(normalized);
                  }}
                  className="border-border/70 bg-muted/45 h-7 px-2 pr-6 text-right text-xs"
                />
              </div>
            </div>
            <span className="font-mono font-bold text-red-400">
              -{formatMMK(totals.discountAmount)}
            </span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">
                Tax (Commercial Tax)
              </span>
              <div className="relative w-16">
                <Percent className="text-muted-foreground absolute top-1/2 right-2 h-3 w-3 -translate-y-1/2" />
                <Input
                  type="number"
                  value={isTaxEditing ? taxInput : String(taxPercent)}
                  onFocus={() => {
                    setIsTaxEditing(true);
                    setTaxInput(String(taxPercent));
                  }}
                  onChange={(e) => {
                    setTaxInput(e.target.value);
                  }}
                  onBlur={() => {
                    const parsed = Number.parseFloat(taxInput);
                    const normalized = Number.isFinite(parsed)
                      ? Math.min(100, Math.max(0, parsed))
                      : taxPercent;
                    setIsTaxEditing(false);
                    setTax(normalized);
                  }}
                  className="border-border/70 bg-muted/45 h-7 px-2 pr-6 text-right text-xs"
                />
              </div>
            </div>
            <span className="font-mono font-bold text-blue-400">
              +{formatMMK(totals.taxAmount)}
            </span>
          </div>

          <div className="border-border/70 mt-2 border-t pt-4">
            <div className="flex items-end justify-between">
              <div className="space-y-1">
                <span className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
                  Grand Total
                </span>
                <p className="text-muted-foreground/60 text-[10px] italic">
                  All prices in Myanmar Kyat (MMK)
                </p>
              </div>
              <div className="bg-gradient-to-br from-amber-400 to-orange-600 bg-clip-text font-mono text-3xl font-black tracking-tighter text-transparent drop-shadow-sm">
                {formatMMK(totals.total)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
