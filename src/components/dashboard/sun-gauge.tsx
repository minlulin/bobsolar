'use client';

import type * as React from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type SunGaugeProps = {
  revenue: number;
  activeProjects: number;
  pendingQuotes: number;
  overdueAlerts: number;
};

export function SunGauge({
  revenue,
  activeProjects,
  pendingQuotes,
  overdueAlerts,
}: SunGaugeProps): React.JSX.Element {
  const max = Math.max(
    revenue,
    activeProjects,
    pendingQuotes,
    overdueAlerts,
    1,
  );

  return (
    <div className="border-border bg-card relative rounded-xl border p-6">
      <h3 className="text-foreground mb-6 text-sm font-semibold tracking-wide">
        Solar Orbit Metrics
      </h3>

      <div className="grid grid-cols-2 gap-4">
        <MetricDot
          color="bg-amber-500"
          size={16 + (revenue / max) * 22}
          label="Revenue"
          value={`${Math.round(revenue).toLocaleString('en-US')} MMK`}
          shortLabel={`${Math.round(revenue / 1000000)}`}
        />
        <MetricDot
          color="bg-emerald-500"
          size={16 + (activeProjects / max) * 22}
          label="Active Projects"
          value={`${activeProjects} projects`}
          shortLabel={`${activeProjects}`}
        />
        <MetricDot
          color="bg-indigo-500"
          size={16 + (pendingQuotes / max) * 22}
          label="Pending Quotes"
          value={`${pendingQuotes} quotations`}
          shortLabel={`${pendingQuotes}`}
        />
        <MetricDot
          color="bg-red-500"
          size={16 + (overdueAlerts / max) * 22}
          label="Overdue Alerts"
          value={`${overdueAlerts} overdue`}
          shortLabel={`${overdueAlerts}`}
        />
      </div>
    </div>
  );
}

function MetricDot({
  color,
  size,
  label,
  value,
  shortLabel,
}: {
  color: string;
  size: number;
  label: string;
  value: string;
  shortLabel: string;
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="border-border bg-muted/25 hover:bg-muted/45 flex items-center gap-4 rounded-lg border p-4 transition-colors">
          <div
            className={`flex shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${color}`}
            style={{ width: size, height: size }}
          >
            {shortLabel}
          </div>
          <div className="min-w-0">
            <p className="text-foreground truncate text-sm leading-tight font-medium">
              {label}
            </p>
            <p className="text-muted-foreground truncate text-xs">
              {shortLabel} items
            </p>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent sideOffset={8}>
        <div className="space-y-0.5">
          <p className="text-xs font-semibold">{label}</p>
          <p className="text-xs opacity-90">{value}</p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
