'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import {
  ChevronLeft,
  Download,
  Copy,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  type Quotation,
  type QuotationItem,
  type Customer,
} from '@/lib/db/schema';
import {
  updateQuotationStatus,
  duplicateQuotation,
} from '@/actions/quotation-actions';
import { formatMMK } from '@/lib/utils';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { QuotePreview } from '@/app/(dashboard)/quotations/new/components/quote-preview';
import { useQuoteBuilderStore } from '@/stores/quote-builder-store';
import { STATUS_CONFIG } from '@/lib/constants';
import { showLinkedToast } from '@/components/shared/toast-link';

interface QuoteDetailViewProps {
  quotation: Quotation & {
    items: QuotationItem[];
    customer: Customer;
    project?: { id: string; projectNumber: string } | null;
  };
}

export function QuoteDetailView({ quotation }: QuoteDetailViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const loadFromQuotation = useQuoteBuilderStore(
    (state) => state.loadFromQuotation,
  );

  const handleStatusChange = async (newStatus: Quotation['status']) => {
    startTransition(async () => {
      const res = await updateQuotationStatus(quotation.id, newStatus);
      if (res.success) {
        showLinkedToast({
          title: `Status updated to ${newStatus}`,
          description: 'Click to open quotation detail',
          href: `/quotations/${quotation.id}`,
          variant: 'success',
        });
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  const handleDuplicate = async () => {
    startTransition(async () => {
      const res = await duplicateQuotation(quotation.id);
      if (res.success) {
        toast.success('Quotation duplicated as draft');
        router.push(`/quotations/${res.data.id}`);
      } else {
        toast.error(res.error);
      }
    });
  };

  const handleReopen = async () => {
    handleStatusChange('draft');
  };

  const status = quotation.status as keyof typeof STATUS_CONFIG;
  const config = STATUS_CONFIG[status];
  const StatusIcon = config.icon;

  // We need to sync the store so the QuotePreview works correctly in read-only mode too
  React.useEffect(() => {
    loadFromQuotation(quotation);
  }, [quotation, loadFromQuotation]);

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 pb-32">
      {/* Header */}
      <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Back to quotations"
            onClick={() => router.push('/quotations')}
            className="rounded-full hover:bg-white/5"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="mb-1 flex items-center gap-3">
              <h1 className="text-2xl font-black tracking-tight text-white uppercase italic">
                {quotation.quoteNumber}
              </h1>
              <Badge
                className={cn(
                  'border px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase',
                  config.color,
                )}
              >
                <StatusIcon className="mr-1 h-3 w-3" />
                {config.label}
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm">
              Created on {format(new Date(quotation.createdAt), 'MMM dd, yyyy')}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Action Buttons based on Status */}
          {status === 'sent' && (
            <>
              <Button
                variant="outline"
                onClick={() => handleStatusChange('rejected')}
                disabled={isPending}
                className="border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20"
              >
                Mark Rejected
              </Button>
              <Button
                onClick={() => handleStatusChange('accepted')}
                disabled={isPending}
                className="bg-emerald-600 font-bold text-white hover:bg-emerald-700"
              >
                Mark Accepted
              </Button>
            </>
          )}

          {status === 'rejected' && (
            <Button
              variant="outline"
              onClick={handleReopen}
              disabled={isPending}
              className="border-white/10 bg-white/5 hover:bg-white/10"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Reopen as Draft
            </Button>
          )}

          {status === 'accepted' &&
            (quotation.project ? (
              <Button
                asChild
                className="bg-gradient-to-r from-emerald-600 to-teal-600 font-bold text-white hover:brightness-110"
              >
                <Link href={`/projects/${quotation.project.id}`}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View Project {quotation.project.projectNumber}
                </Link>
              </Button>
            ) : (
              <Button
                className="bg-gradient-to-r from-amber-500 to-orange-600 font-bold text-white"
                onClick={() =>
                  router.push(`/projects/new?quoteId=${quotation.id}`)
                }
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Convert to Project
              </Button>
            ))}

          <Button
            variant="outline"
            onClick={handleDuplicate}
            disabled={isPending}
            className="border-white/10 bg-white/5 hover:bg-white/10"
          >
            <Copy className="mr-2 h-4 w-4" />
            Duplicate
          </Button>

          <Button
            variant="outline"
            className="border-white/10 bg-white/5 hover:bg-white/10"
            onClick={() =>
              window.open(`/quotations/${quotation.id}/pdf`, '_blank')
            }
          >
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_400px]">
        {/* Detail Pane */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Customer Info Card */}
          <div className="space-y-4 rounded-2xl border border-white/5 bg-white/[0.03] p-6">
            <h3 className="text-xs font-bold tracking-[0.2em] text-amber-500/80 uppercase">
              Customer Information
            </h3>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-1">
                <p className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                  Name
                </p>
                <p className="text-lg font-semibold">
                  {quotation.customer.name}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                  Contact
                </p>
                <p className="font-semibold">{quotation.customer.phone}</p>
                {quotation.customer.email && (
                  <p className="text-muted-foreground text-sm">
                    {quotation.customer.email}
                  </p>
                )}
              </div>
              <div className="space-y-1 md:col-span-2">
                <p className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                  Address
                </p>
                <p className="text-muted-foreground text-sm">
                  {quotation.customer.address}, {quotation.customer.city}
                </p>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="space-y-4 rounded-2xl border border-white/5 bg-white/[0.03] p-6">
            <h3 className="text-xs font-bold tracking-[0.2em] text-amber-500/80 uppercase">
              Quotation Items
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground/60 border-b border-white/5 text-[10px] font-bold tracking-wider uppercase">
                    <th className="px-2 py-3 text-left">Description</th>
                    <th className="w-20 px-2 py-3 text-center">Qty</th>
                    <th className="w-32 px-2 py-3 text-right">Unit Price</th>
                    <th className="w-32 px-2 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {quotation.items.map((item) => (
                    <tr
                      key={item.id}
                      className="group transition-colors hover:bg-white/[0.02]"
                    >
                      <td className="px-2 py-4 font-medium">
                        {item.description}
                      </td>
                      <td className="text-muted-foreground px-2 py-4 text-center font-mono">
                        {item.quantity}
                      </td>
                      <td className="px-2 py-4 text-right font-mono">
                        {formatMMK(Number(item.unitPrice))}
                      </td>
                      <td className="px-2 py-4 text-right font-mono font-bold">
                        {formatMMK(Number(item.totalPrice))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals Summary */}
            <div className="flex justify-end border-t border-white/5 pt-6">
              <div className="w-64 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-mono">
                    {formatMMK(Number(quotation.subtotal))}
                  </span>
                </div>
                {Number(quotation.discountAmount) > 0 && (
                  <div className="flex justify-between text-sm text-red-400">
                    <span>Discount ({quotation.discountPercent}%)</span>
                    <span className="font-mono">
                      -{formatMMK(Number(quotation.discountAmount))}
                    </span>
                  </div>
                )}
                {Number(quotation.taxAmount) > 0 && (
                  <div className="flex justify-between text-sm text-blue-400">
                    <span>Tax ({quotation.taxPercent}%)</span>
                    <span className="font-mono">
                      +{formatMMK(Number(quotation.taxAmount))}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-white/10 pt-4">
                  <span className="text-xs font-bold tracking-widest text-amber-500 uppercase">
                    Total
                  </span>
                  <span className="font-mono text-2xl font-black tracking-tighter text-white">
                    {formatMMK(Number(quotation.total))}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes Section */}
          {quotation.notes && (
            <div className="space-y-2 rounded-2xl border border-white/5 bg-white/[0.03] p-6">
              <h3 className="text-xs font-bold tracking-[0.2em] text-amber-500/80 uppercase">
                Notes & Terms
              </h3>
              <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                {quotation.notes}
              </p>
            </div>
          )}
        </motion.div>

        {/* Right Pane: Live Preview (Hidden on mobile) */}
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
