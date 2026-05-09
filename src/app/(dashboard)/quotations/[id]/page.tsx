'use client';

import { useParams, useRouter } from 'next/navigation';
import {
  ChevronLeft,
  Phone,
  Mail,
  MapPin,
  FileText,
  Printer,
  Download,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  AlertTriangle,
  Loader2,
  Trash2,
} from 'lucide-react';
import {
  useQuotation,
  useUpdateQuotationStatus,
  useDeleteQuotation,
} from '@/hooks/use-quotations';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { formatMMK } from '@/lib/pricing/engine';
import { cn } from '@/lib/utils';
import { type QuotationItem } from '@/lib/db/schema';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const statusConfig = {
  draft: {
    label: 'Draft',
    color: 'bg-slate-500/10 text-slate-500',
    icon: Clock,
  },
  sent: {
    label: 'Sent',
    color: 'bg-indigo-500/10 text-indigo-500',
    icon: Send,
  },
  accepted: {
    label: 'Accepted',
    color: 'bg-emerald-500/10 text-emerald-500',
    icon: CheckCircle2,
  },
  rejected: {
    label: 'Rejected',
    color: 'bg-rose-500/10 text-rose-500',
    icon: XCircle,
  },
  expired: {
    label: 'Expired',
    color: 'bg-amber-500/10 text-amber-500',
    icon: AlertTriangle,
  },
};

export default function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: response, isLoading } = useQuotation(id);
  const { mutate: updateStatus, isPending: isUpdating } =
    useUpdateQuotationStatus();
  const { mutate: deleteQuote } = useDeleteQuotation();

  const quotation = response?.success ? response.data : null;

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="text-solar h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <h2 className="text-2xl font-bold">Quotation not found</h2>
        <Button
          variant="link"
          onClick={() => router.push('/quotations')}
          className="mt-4"
        >
          Back to list
        </Button>
      </div>
    );
  }

  const config =
    statusConfig[quotation.status as keyof typeof statusConfig] ||
    statusConfig.draft;
  const StatusIcon = config.icon;

  const handleStatusChange = (
    newStatus: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired',
  ) => {
    updateStatus({ id: quotation.id, status: newStatus });
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this draft?')) {
      deleteQuote(quotation.id, {
        onSuccess: (res) => {
          if (res.success) router.push('/quotations');
        },
      });
    }
  };

  const parseDecimal = (val: string | number | null | undefined) =>
    parseFloat(val?.toString() ?? '0');

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/quotations')}
          className="group text-muted-foreground hover:text-foreground -ml-2 w-fit"
        >
          <ChevronLeft className="mr-1 h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Back to Quotations
        </Button>

        <div className="flex items-center gap-2">
          {quotation.status === 'draft' && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleStatusChange('sent')}
                disabled={isUpdating}
              >
                <Send className="mr-2 h-4 w-4" />
                Mark as Sent
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10"
                onClick={handleDelete}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
          {quotation.status === 'sent' && (
            <>
              <Button
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                size="sm"
                onClick={() => handleStatusChange('accepted')}
                disabled={isUpdating}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Accept
              </Button>
              <Button
                variant="outline"
                className="border-rose-500/20 text-rose-500 hover:bg-rose-500/10"
                size="sm"
                onClick={() => handleStatusChange('rejected')}
                disabled={isUpdating}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" className="gap-2">
            <Printer className="h-4 w-4" />
            Print
          </Button>
          <Button
            size="sm"
            className="bg-solar shadow-solar hover:bg-solar/90 gap-2 text-white"
          >
            <Download className="h-4 w-4" />
            Export PDF
          </Button>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <Card className="overflow-hidden border-white/5 bg-white/5 shadow-2xl">
            <div className="bg-solar h-2 w-full" />
            <CardContent className="space-y-12 p-8 sm:p-12">
              <div className="flex flex-col justify-between gap-8 sm:flex-row sm:items-start">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-solar shadow-solar flex h-12 w-12 items-center justify-center rounded-xl text-white">
                      <FileText className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="font-heading text-2xl font-bold tracking-tight text-white">
                        BOB Solar
                      </h2>
                      <p className="text-solar text-xs font-medium tracking-widest uppercase">
                        Premium Solar Solutions
                      </p>
                    </div>
                  </div>
                  <div className="text-muted-foreground space-y-1 text-sm">
                    <p>No. 123, Solar Avenue, Yangon</p>
                    <p>+95 9 123 456 789</p>
                    <p>sales@bobsolar.com</p>
                  </div>
                </div>

                <div className="space-y-2 text-right">
                  <h1 className="font-heading text-4xl font-black tracking-tighter text-white uppercase">
                    Quotation
                  </h1>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-solar text-sm font-bold">
                      {quotation.quoteNumber}
                    </span>
                    <Badge
                      className={cn(
                        'px-2 py-0.5 text-[10px] font-bold uppercase',
                        config.color,
                      )}
                    >
                      <StatusIcon className="mr-1 h-3 w-3" />
                      {config.label}
                    </Badge>
                  </div>
                </div>
              </div>

              <Separator className="bg-white/5" />

              <div className="grid gap-8 sm:grid-cols-2">
                <div className="space-y-4">
                  <span className="text-solar text-xs font-bold tracking-widest uppercase">
                    Bill To
                  </span>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-white">
                      {quotation.customer.name}
                    </h3>
                    <div className="text-muted-foreground space-y-1 text-sm">
                      <p className="flex items-center gap-2">
                        <Phone className="h-3 w-3" /> {quotation.customer.phone}
                      </p>
                      {quotation.customer.email && (
                        <p className="flex items-center gap-2">
                          <Mail className="h-3 w-3" />{' '}
                          {quotation.customer.email}
                        </p>
                      )}
                      {quotation.customer.address && (
                        <p className="flex items-center gap-2">
                          <MapPin className="h-3 w-3" />{' '}
                          {quotation.customer.address}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-4 sm:items-end">
                  <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-right">
                    <span className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
                      Date Issued
                    </span>
                    <span className="text-sm font-medium text-white">
                      {format(new Date(quotation.createdAt), 'MMM d, yyyy')}
                    </span>
                    <span className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
                      Valid Until
                    </span>
                    <span className="text-sm font-medium text-white">
                      {quotation.validUntil
                        ? format(new Date(quotation.validUntil), 'MMM d, yyyy')
                        : '30 Days from issue'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-white/5 bg-white/[0.02]">
                <Table>
                  <TableHeader className="bg-white/5">
                    <TableRow className="border-white/5 hover:bg-transparent">
                      <TableHead className="text-solar text-xs font-bold tracking-wider uppercase">
                        Description
                      </TableHead>
                      <TableHead className="text-solar text-center text-xs font-bold tracking-wider uppercase">
                        Qty
                      </TableHead>
                      <TableHead className="text-solar text-right text-xs font-bold tracking-wider uppercase">
                        Unit Price
                      </TableHead>
                      <TableHead className="text-solar text-right text-xs font-bold tracking-wider uppercase">
                        Total
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {((quotation.items ?? []) as QuotationItem[]).map(
                      (item) => (
                        <TableRow
                          key={item.id}
                          className="border-white/5 hover:bg-white/5"
                        >
                          <TableCell className="font-medium text-white">
                            {item.description}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-center">
                            {parseDecimal(item.quantity)}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-right">
                            {formatMMK(parseDecimal(item.unitPrice))}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-white">
                            {formatMMK(parseDecimal(item.totalPrice))}
                          </TableCell>
                        </TableRow>
                      ),
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col items-end gap-6 pt-4">
                <div className="w-full max-w-xs space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium text-white">
                      {formatMMK(parseDecimal(quotation.subtotal))}
                    </span>
                  </div>
                  {parseDecimal(quotation.discountAmount) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Discount ({parseDecimal(quotation.discountPercent)}%)
                      </span>
                      <span className="font-medium text-rose-500">
                        -{formatMMK(parseDecimal(quotation.discountAmount))}
                      </span>
                    </div>
                  )}
                  <div className="text-solar flex justify-between text-sm">
                    <span className="font-medium">
                      Commercial Tax ({parseDecimal(quotation.taxPercent)}%)
                    </span>
                    <span className="font-medium">
                      +{formatMMK(parseDecimal(quotation.taxAmount))}
                    </span>
                  </div>
                  <Separator className="bg-white/5" />
                  <div className="flex justify-between pt-2">
                    <span className="font-heading text-lg font-bold tracking-wider text-white uppercase">
                      Total
                    </span>
                    <span className="font-heading text-solar text-2xl font-bold">
                      {formatMMK(parseDecimal(quotation.total))}
                    </span>
                  </div>
                </div>
              </div>

              {quotation.notes && (
                <div className="space-y-2 rounded-xl border border-white/5 bg-white/5 p-6">
                  <h4 className="text-solar text-xs font-bold tracking-widest uppercase">
                    Terms & Notes
                  </h4>
                  <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">
                    {quotation.notes}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-white/5 bg-white/5">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">
                Workflow Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative flex flex-col gap-6 border-l border-white/5 pl-4">
                <div className="relative">
                  <div className="absolute top-1 -left-[21px] h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-white">
                      Quotation Drafted
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {format(
                        new Date(quotation.createdAt),
                        'MMM d, yyyy h:mm a',
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
