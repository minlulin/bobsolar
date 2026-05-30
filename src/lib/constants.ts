import { AlertTriangle, CheckCircle2, Clock, type LucideIcon, Send, XCircle } from "lucide-react";
import type { InventoryCategory, QuotationStatus } from "@/lib/db/schema";
import { QUOTATION_STATUS_LABELS } from "@/lib/domain/quotation";

type QuotationStatusConfig = {
  label: string;
  color: string;
  icon: LucideIcon;
};

export const STATUS_CONFIG: Record<QuotationStatus, QuotationStatusConfig> = {
  draft: {
    label: QUOTATION_STATUS_LABELS.draft,
    color: "bg-slate-500/10 text-slate-500",
    icon: Clock,
  },
  sent: {
    label: QUOTATION_STATUS_LABELS.sent,
    color: "bg-indigo-500/10 text-indigo-500",
    icon: Send,
  },
  accepted: {
    label: QUOTATION_STATUS_LABELS.accepted,
    color: "bg-emerald-500/10 text-emerald-500",
    icon: CheckCircle2,
  },
  rejected: {
    label: QUOTATION_STATUS_LABELS.rejected,
    color: "bg-rose-500/10 text-rose-500",
    icon: XCircle,
  },
  expired: {
    label: QUOTATION_STATUS_LABELS.expired,
    color: "bg-amber-500/10 text-amber-500",
    icon: AlertTriangle,
  },
};

export const STOCK_WARNING_THRESHOLDS: Record<InventoryCategory | "default", number> = {
  panel: 20,
  inverter: 5,
  battery: 10,
  mounting: 50,
  cable: 100, // meters
  accessory: 20,
  protection: 10,
  labor: 0,
  service: 0,
  default: 10,
};
