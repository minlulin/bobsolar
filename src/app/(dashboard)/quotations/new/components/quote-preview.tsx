'use client';

import * as React from 'react';
import { useQuoteBuilderStore } from '@/stores/quote-builder-store';
import { formatMMK } from '@/lib/pricing/engine';
import { useQuery } from '@tanstack/react-query';
import { getCustomer } from '@/actions/customer-actions';
import { format } from 'date-fns';
import { FileText, Zap, MapPin, Phone } from 'lucide-react';

export function QuotePreview() {
  const {
    selectedCustomerId,
    items,
    discountPercent,
    taxPercent,
    notes,
    validUntil,
    getTotals,
  } = useQuoteBuilderStore();

  const { data: customerRes } = useQuery({
    queryKey: ['customers', selectedCustomerId],
    queryFn: () => getCustomer(selectedCustomerId!),
    enabled: !!selectedCustomerId,
  });

  const customer = customerRes?.success ? customerRes.data : null;
  const totals = getTotals();

  return (
    <div className="sticky top-8 h-fit">
      <div className="mb-4 flex items-center gap-2 px-2">
        <FileText className="h-4 w-4 text-amber-500" />
        <h3 className="text-muted-foreground text-sm font-bold tracking-wider uppercase">
          Live Preview
        </h3>
      </div>

      <div className="flex aspect-[1/1.414] w-full flex-col overflow-hidden rounded-lg bg-white p-8 text-[10px] text-zinc-950 shadow-2xl shadow-amber-500/5">
        {/* Company Header */}
        <div className="mb-6 flex items-start justify-between border-b-2 border-amber-500 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-amber-600">
              <Zap className="h-5 w-5 fill-current" />
              <span className="text-xl font-black tracking-tighter uppercase italic">
                BOB Solar
              </span>
            </div>
            <p className="text-muted-foreground leading-tight">
              Premium Solar Solutions
              <br />
              Yangon, Myanmar
            </p>
          </div>
          <div className="space-y-1 text-right">
            <h2 className="text-2xl font-black text-zinc-300 uppercase">
              Quotation
            </h2>
            <p className="font-bold">QT-2026-XXXX</p>
            <p className="text-muted-foreground">
              {format(new Date(), 'MMM dd, yyyy')}
            </p>
          </div>
        </div>

        {/* Info Grid */}
        <div className="mb-8 grid grid-cols-2 gap-8">
          <div className="space-y-1.5">
            <h4 className="mb-1 border-b border-amber-100 pb-0.5 text-[8px] font-bold text-amber-600 uppercase">
              Client
            </h4>
            <p className="text-sm font-bold">{customer?.name || '---'}</p>
            <div className="text-muted-foreground flex items-center gap-1">
              <Phone className="h-2.5 w-2.5" />
              <span>{customer?.phone || '---'}</span>
            </div>
            <div className="text-muted-foreground flex items-start gap-1">
              <MapPin className="mt-0.5 h-2.5 w-2.5" />
              <span>
                {customer?.address
                  ? `${customer.address}, ${customer.city}`
                  : '---'}
              </span>
            </div>
          </div>

          <div className="space-y-1.5 text-right">
            <h4 className="mb-1 border-b border-amber-100 pb-0.5 text-right text-[8px] font-bold text-amber-600 uppercase">
              Validity
            </h4>
            <p className="font-bold">Valid Until</p>
            <p>{validUntil ? format(validUntil, 'MMM dd, yyyy') : '---'}</p>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="text-muted-foreground py-2 text-left text-[8px] font-bold uppercase">
                  Description
                </th>
                <th className="text-muted-foreground py-2 text-center text-[8px] font-bold uppercase">
                  Qty
                </th>
                <th className="text-muted-foreground py-2 text-right text-[8px] font-bold uppercase">
                  Price
                </th>
                <th className="text-muted-foreground py-2 text-right text-[8px] font-bold uppercase">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {items.map((item, i) => (
                <tr key={i}>
                  <td className="py-2.5 font-medium">{item.description}</td>
                  <td className="py-2.5 text-center">{item.quantity}</td>
                  <td className="py-2.5 text-right">
                    {formatMMK(item.unitPrice)}
                  </td>
                  <td className="py-2.5 text-right font-bold">
                    {formatMMK(item.quantity * item.unitPrice)}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="py-12 text-center text-zinc-300 italic"
                  >
                    No items added to quotation
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="mt-8 flex justify-end border-t-2 border-zinc-950 pt-4">
          <div className="w-48 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-[8px] font-bold uppercase">
                Subtotal
              </span>
              <span className="font-bold">{formatMMK(totals.subtotal)}</span>
            </div>
            {totals.discountAmount > 0 && (
              <div className="flex items-center justify-between text-red-600">
                <span className="text-[8px] font-bold uppercase">
                  Discount ({discountPercent}%)
                </span>
                <span className="font-bold">
                  -{formatMMK(totals.discountAmount)}
                </span>
              </div>
            )}
            {totals.taxAmount > 0 && (
              <div className="flex items-center justify-between text-blue-600">
                <span className="text-[8px] font-bold uppercase">
                  Tax ({taxPercent}%)
                </span>
                <span className="font-bold">
                  +{formatMMK(totals.taxAmount)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-zinc-200 pt-2">
              <span className="text-[10px] font-black text-amber-600 uppercase">
                Grand Total
              </span>
              <span className="text-lg font-black text-zinc-950">
                {formatMMK(totals.total)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-muted-foreground mt-auto flex items-end justify-between border-t border-zinc-100 pt-8 text-[7px]">
          <div className="space-y-1">
            <p className="text-[8px] font-bold text-zinc-950 uppercase">
              Notes & Terms
            </p>
            <p className="max-w-[200px] whitespace-pre-wrap">
              {notes || 'Thank you for your business.'}
            </p>
          </div>
          <div className="text-right">
            <p className="font-bold text-zinc-950 uppercase">Approved By</p>
            <div className="mt-1 ml-auto h-8 w-24 border-b border-zinc-200"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
