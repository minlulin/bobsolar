'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { ChevronLeft, Save, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CustomerSelector } from './customer-selector';
import { InventorySearch } from './inventory-search';
import { QuoteItems } from './quote-items';
import { QuoteSummary } from './quote-summary';
import { QuotePreview } from './quote-preview';
import { useQuoteBuilderStore } from '@/stores/quote-builder-store';
import { createQuotation, updateQuotation } from '@/actions/quotation-actions';
import { motion } from 'framer-motion';

interface QuoteEditorProps {
  mode: 'create' | 'edit';
  quotationId?: string;
  initialQuoteNumber?: string;
}

export function QuoteEditor({
  mode,
  quotationId,
  initialQuoteNumber,
}: QuoteEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const {
    selectedCustomerId,
    items,
    discountPercent,
    taxPercent,
    notes,
    validUntil,
    reset,
  } = useQuoteBuilderStore();

  const handleSave = async (status: 'draft' | 'sent' = 'draft') => {
    if (!selectedCustomerId) {
      toast.error('Please select a customer');
      return;
    }
    if (items.length === 0) {
      toast.error('Please add at least one item');
      return;
    }

    startTransition(async () => {
      const data = {
        customerId: selectedCustomerId,
        items: items.map((item) => ({
          itemId: item.itemId,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountPercentage: item.discountPercentage,
          sortOrder: item.sortOrder,
        })),
        discountPercent,
        taxPercent,
        notes,
        validUntil,
      };

      const res =
        mode === 'create'
          ? await createQuotation(data)
          : await updateQuotation(quotationId!, data);

      if (res.success) {
        toast.success(
          mode === 'create'
            ? status === 'sent'
              ? 'Quotation sent successfully'
              : 'Quotation created'
            : 'Quotation updated',
        );
        reset();
        router.push('/quotations');
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 pb-32">
      {/* Header */}
      <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="rounded-full hover:bg-white/5"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white uppercase italic">
              {mode === 'create' ? 'New' : 'Edit'}{' '}
              <span className="text-amber-500">Quotation</span>
            </h1>
            <p className="text-muted-foreground text-sm">
              {mode === 'create'
                ? 'Build a professional solar proposal'
                : `Editing ${initialQuoteNumber}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => handleSave('draft')}
            disabled={isPending}
            className="border-white/10 bg-white/5 transition-all hover:bg-white/10"
          >
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {mode === 'create' ? 'Save Draft' : 'Update Draft'}
          </Button>
          <Button
            onClick={() => handleSave('sent')}
            disabled={isPending}
            className="bg-gradient-to-r from-amber-500 to-orange-600 px-6 font-bold text-white shadow-lg shadow-amber-500/20 transition-all hover:from-amber-600 hover:to-orange-700"
          >
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            {mode === 'create' ? 'Review & Send' : 'Update & Send'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_400px]">
        {/* Editor Pane */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-8"
        >
          {/* Customer Section */}
          <div className="space-y-6 rounded-2xl border border-white/5 bg-white/[0.03] p-6">
            <CustomerSelector />
          </div>

          {/* Items Section */}
          <div className="space-y-6 rounded-2xl border border-white/5 bg-white/[0.03] p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-muted-foreground text-sm font-bold tracking-widest uppercase">
                Line Items
              </h3>
              <InventorySearch />
            </div>

            <QuoteItems />

            <QuoteSummary />
          </div>
        </motion.div>

        {/* Preview Pane */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="hidden lg:block"
        >
          <QuotePreview />
        </motion.div>
      </div>
    </div>
  );
}
