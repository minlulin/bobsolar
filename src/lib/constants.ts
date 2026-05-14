import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Send,
  type LucideIcon,
  XCircle,
} from 'lucide-react';
import type { InventoryCategory, QuotationStatus } from '@/lib/db/schema';

type QuotationStatusConfig = {
  label: string;
  color: string;
  icon: LucideIcon;
};

export const STATUS_CONFIG: Record<QuotationStatus, QuotationStatusConfig> = {
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

export const STOCK_WARNING_THRESHOLDS: Record<
  InventoryCategory | 'default',
  number
> = {
  panel: 50,
  inverter: 5,
  battery: 10,
  mounting: 20,
  cable: 30,
  accessory: 15,
  labor: 1,
  default: 10,
};
