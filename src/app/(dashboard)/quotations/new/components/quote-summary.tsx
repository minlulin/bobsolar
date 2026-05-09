'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useQuoteBuilderStore } from '@/stores/quote-builder-store';
import { formatMMK } from '@/lib/pricing/engine';
import { Calendar as CalendarIcon, Percent } from 'lucide-react';

export function QuoteSummary() {
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

  const totals = getTotals();

  return (
    <div className="grid grid-cols-1 gap-8 border-t border-white/5 pt-6 md:grid-cols-2">
      {/* Left: Notes and Expiry */}
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-muted-foreground ml-1 text-sm font-medium">
            Additional Notes
          </label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Terms, bank details, or special instructions..."
            className="min-h-[120px] resize-none border-white/10 bg-white/[0.02] transition-all focus:border-amber-500/50"
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
              onChange={(e) =>
                setValidUntil(e.target.value ? new Date(e.target.value) : null)
              }
              className="border-white/10 bg-white/[0.02] pl-10 transition-all focus:border-amber-500/50"
            />
          </div>
        </div>
      </div>

      {/* Right: Totals Calculation */}
      <div className="space-y-4 rounded-2xl border border-white/5 bg-white/[0.02] p-6">
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
                  value={discountPercent}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                  className="h-7 border-white/10 bg-white/5 px-2 pr-6 text-right text-xs"
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
                  value={taxPercent}
                  onChange={(e) => setTax(parseFloat(e.target.value) || 0)}
                  className="h-7 border-white/10 bg-white/5 px-2 pr-6 text-right text-xs"
                />
              </div>
            </div>
            <span className="font-mono font-bold text-blue-400">
              +{formatMMK(totals.taxAmount)}
            </span>
          </div>

          <div className="mt-2 border-t border-white/10 pt-4">
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
