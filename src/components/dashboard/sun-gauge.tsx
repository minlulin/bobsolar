'use client';

import { motion } from 'framer-motion';
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
}: SunGaugeProps) {
  const max = Math.max(revenue, activeProjects, pendingQuotes, overdueAlerts, 1);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-amber-500/20 bg-gradient-to-br from-black via-zinc-950 to-amber-950/40 p-6">
      <div className="relative mx-auto h-72 w-72">
        <motion.div
          className="absolute top-1/2 left-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-400/80 blur-xl"
          animate={{ opacity: [0.5, 0.9, 0.5], scale: [1, 1.1, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="absolute top-1/2 left-1/2 z-10 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-300" />

        <OrbitDot
          angle={0}
          color="#f59e0b"
          size={16 + (revenue / max) * 22}
          shortLabel={Math.round(revenue / 1000000)}
          title="Revenue"
          detail={`${Math.round(revenue).toLocaleString('en-US')} MMK`}
        />
        <OrbitDot
          angle={90}
          color="#10b981"
          size={16 + (activeProjects / max) * 22}
          shortLabel={activeProjects}
          title="Active Projects"
          detail={`${activeProjects} projects`}
        />
        <OrbitDot
          angle={180}
          color="#6366f1"
          size={16 + (pendingQuotes / max) * 22}
          shortLabel={pendingQuotes}
          title="Pending Quotes"
          detail={`${pendingQuotes} quotations`}
        />
        <OrbitDot
          angle={270}
          color="#ef4444"
          size={16 + (overdueAlerts / max) * 22}
          shortLabel={overdueAlerts}
          title="Overdue Alerts"
          detail={`${overdueAlerts} overdue`}
        />

        <div className="absolute inset-6 rounded-full border border-white/10" />
        <div className="absolute inset-14 rounded-full border border-white/10" />
      </div>
      <p className="mt-3 text-center text-xs tracking-[0.18em] text-amber-300 uppercase">
        Solar Orbit Metrics
      </p>
    </div>
  );
}

function OrbitDot({
  angle,
  color,
  size,
  shortLabel,
  title,
  detail,
}: {
  angle: number;
  color: string;
  size: number;
  shortLabel: number;
  title: string;
  detail: string;
}) {
  const radius = 110;
  const rad = (angle * Math.PI) / 180;
  const x = 144 + Math.cos(rad) * radius - size / 2;
  const y = 144 + Math.sin(rad) * radius - size / 2;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.button
          type="button"
          className="absolute flex items-center justify-center rounded-full text-[10px] font-bold text-white"
          style={{
            left: x,
            top: y,
            width: size,
            height: size,
            backgroundColor: color,
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
        >
          <span className="scale-75">{shortLabel}</span>
        </motion.button>
      </TooltipTrigger>
      <TooltipContent sideOffset={8}>
        <div className="space-y-0.5">
          <p className="text-xs font-semibold">{title}</p>
          <p className="text-xs opacity-90">{detail}</p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
