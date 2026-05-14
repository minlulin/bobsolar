'use client';

import type * as React from 'react';
import { motion, type Transition } from 'framer-motion';
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

const orbitTransition = {
  duration: 52,
  repeat: Number.POSITIVE_INFINITY,
  ease: [0.45, 0, 0.2, 1],
} satisfies Transition;

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
    <motion.div
      className="surface-card relative overflow-hidden rounded-3xl border-amber-500/25 bg-[linear-gradient(135deg,color-mix(in_oklab,var(--card)_94%,transparent),color-mix(in_oklab,var(--muted)_80%,transparent)_52%,color-mix(in_oklab,var(--primary)_20%,transparent))] p-6 shadow-[0_28px_90px_-62px_rgba(245,158,11,0.45),inset_0_1px_0_rgba(255,255,255,0.12)]"
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
    >
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/50 to-transparent" />
      <motion.div
        aria-hidden="true"
        className="absolute top-8 -right-20 h-52 w-52 rounded-full bg-amber-400/10 blur-3xl"
        animate={{ opacity: [0.32, 0.58, 0.32], scale: [0.94, 1.08, 0.94] }}
        transition={{
          duration: 7.5,
          ease: [0.33, 1, 0.68, 1],
          repeat: Number.POSITIVE_INFINITY,
        }}
      />
      <div className="relative mx-auto h-72 w-72">
        <motion.div
          className="absolute top-1/2 left-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-400/80 blur-xl"
          animate={{ opacity: [0.5, 0.9, 0.5], scale: [1, 1.1, 1] }}
          transition={{
            duration: 4.6,
            repeat: Number.POSITIVE_INFINITY,
            ease: [0.33, 1, 0.68, 1],
          }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 z-10 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_35%_30%,#fde68a,#f59e0b_58%,#92400e)] shadow-[0_0_44px_rgba(245,158,11,0.58)]"
          animate={{ scale: [1, 1.045, 1], rotate: [0, 8, 0] }}
          transition={{
            duration: 5.8,
            repeat: Number.POSITIVE_INFINITY,
            ease: [0.33, 1, 0.68, 1],
          }}
        />

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

        <motion.div
          className="border-foreground/15 absolute inset-6 rounded-full border"
          animate={{ rotate: 360 }}
          transition={orbitTransition}
        />
        <motion.div
          className="border-foreground/15 absolute inset-14 rounded-full border"
          animate={{ rotate: -360 }}
          transition={{ ...orbitTransition, duration: 68 }}
        />
      </div>
      <p className="mt-3 text-center text-xs tracking-[0.18em] text-amber-500 uppercase dark:text-amber-300">
        Solar Orbit Metrics
      </p>
    </motion.div>
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
}): React.JSX.Element {
  const radius = 110;
  const rad = (angle * Math.PI) / 180;
  const x = 144 + Math.cos(rad) * radius - size / 2;
  const y = 144 + Math.sin(rad) * radius - size / 2;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.button
          type="button"
          className="absolute flex items-center justify-center rounded-full border border-white/35 text-[10px] font-bold text-white shadow-[0_12px_34px_-12px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.28)] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-amber-300/45"
          style={{
            left: x,
            top: y,
            width: size,
            height: size,
            backgroundColor: color,
          }}
          animate={{ y: [0, -5, 2, 0], scale: [1, 1.04, 0.985, 1] }}
          transition={{
            duration: 5.5 + angle / 100,
            repeat: Number.POSITIVE_INFINITY,
            ease: [0.45, 0, 0.2, 1],
          }}
          whileHover={{ scale: 1.22, zIndex: 20 }}
          whileTap={{ scale: 0.92 }}
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
