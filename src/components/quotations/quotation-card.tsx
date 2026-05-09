'use client';

import {
  Calendar,
  User,
  MoreVertical,
  Eye,
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  AlertTriangle,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { type QuotationWithCustomer } from '@/actions/quotation-actions';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { formatMMK } from '@/lib/pricing/engine';
import { useRouter } from 'next/navigation';

interface QuotationCardProps {
  quotation: QuotationWithCustomer;
}

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

export function QuotationCard({ quotation }: QuotationCardProps) {
  const router = useRouter();
  const config = statusConfig[quotation.status as keyof typeof statusConfig];
  const Icon = config.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        className="group cursor-pointer border-white/5 bg-white/5 backdrop-blur-sm transition-all hover:bg-white/10"
        onClick={() => router.push(`/quotations/${quotation.id}`)}
      >
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-solar text-xs font-bold tracking-wider uppercase">
                  {quotation.quoteNumber}
                </span>
                <Badge
                  className={cn(
                    'px-1.5 py-0 text-[10px] font-bold uppercase',
                    config.color,
                  )}
                >
                  <Icon className="mr-1 h-3 w-3" />
                  {config.label}
                </Badge>
              </div>
              <h3 className="font-heading text-foreground line-clamp-1 text-lg font-semibold">
                {quotation.customer.name}
              </h3>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => router.push(`/quotations/${quotation.id}`)}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Draft
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">
                Total Amount
              </span>
              <span className="font-heading text-foreground font-bold">
                {formatMMK(parseFloat(quotation.total.toString()))}
              </span>
            </div>

            <div className="text-muted-foreground flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3 w-3" />
                {format(new Date(quotation.createdAt), 'MMM d, yyyy')}
              </div>
              <div className="flex items-center gap-1.5">
                <User className="h-3 w-3" />
                Sales Team
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-2 border-t border-white/5 pt-4">
            <div className="bg-solar h-1.5 w-1.5 animate-pulse rounded-full" />
            <span className="text-muted-foreground text-[10px] font-medium tracking-widest uppercase">
              Ready for Export
            </span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
