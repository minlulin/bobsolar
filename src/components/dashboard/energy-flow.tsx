'use client';

import Link from 'next/link';
import type * as React from 'react';
import { motion, type Transition } from 'framer-motion';

type PipelineStage = {
  key: 'customers' | 'quotations' | 'projects' | 'completed';
  label: string;
  count: number;
  value: number;
  href: string;
};

type EnergyFlowProps = {
  stages: PipelineStage[];
};

function getStageDetail(node: PipelineStage): string {
  return node.count.toLocaleString('en-US');
}

function widthFromValue(value: number, maxValue: number): number {
  if (maxValue <= 0) return 4;
  return Math.max(4, (value / maxValue) * 14);
}

const flowTransition = {
  duration: 2.65,
  repeat: Number.POSITIVE_INFINITY,
  ease: [0.45, 0, 0.2, 1],
} satisfies Transition;

export function EnergyFlow({ stages }: EnergyFlowProps): React.JSX.Element {
  const nodes = stages.slice(0, 4);
  const maxValue = Math.max(...nodes.map((n) => n.value), 1);

  return (
    <motion.div
      className="relative overflow-hidden rounded-3xl border border-amber-500/20 bg-[linear-gradient(135deg,rgba(9,9,11,0.96),rgba(24,24,27,0.9)_48%,rgba(69,26,3,0.46))] p-6 shadow-[0_28px_90px_-62px_rgba(16,185,129,0.9),inset_0_1px_0_rgba(255,255,255,0.1)]"
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
    >
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-emerald-200/45 to-transparent" />
      <motion.div
        aria-hidden="true"
        className="absolute top-10 -left-24 h-48 w-48 rounded-full bg-emerald-400/10 blur-3xl"
        animate={{ x: [0, 26, 0], opacity: [0.35, 0.62, 0.35] }}
        transition={{
          duration: 8,
          ease: [0.33, 1, 0.68, 1],
          repeat: Number.POSITIVE_INFINITY,
        }}
      />
      <svg viewBox="0 0 900 240" className="hidden h-[220px] w-full md:block">
        <defs>
          <linearGradient id="flow-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="55%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#14b8a6" />
          </linearGradient>
        </defs>

        <path
          d="M170 120 C250 120, 270 120, 350 120"
          stroke="url(#flow-grad)"
          strokeWidth={widthFromValue(nodes[1]?.value ?? 0, maxValue)}
          fill="none"
          strokeLinecap="round"
          opacity="0.75"
        />
        <path
          d="M470 120 C550 120, 570 120, 650 120"
          stroke="url(#flow-grad)"
          strokeWidth={widthFromValue(nodes[2]?.value ?? 0, maxValue)}
          fill="none"
          strokeLinecap="round"
          opacity="0.75"
        />
        <path
          d="M650 120 C730 120, 750 120, 810 120"
          stroke="url(#flow-grad)"
          strokeWidth={widthFromValue(nodes[3]?.value ?? 0, maxValue)}
          fill="none"
          strokeLinecap="round"
          opacity="0.75"
        />

        <motion.circle
          r="6"
          fill="#fbbf24"
          animate={{ cx: [176, 234, 292, 344], cy: [120, 113, 127, 120] }}
          transition={flowTransition}
        />
        <motion.circle
          r="6"
          fill="#34d399"
          animate={{ cx: [476, 532, 590, 644], cy: [120, 128, 113, 120] }}
          transition={{ ...flowTransition, delay: 0.36 }}
        />
        <motion.circle
          r="6"
          fill="#2dd4bf"
          animate={{ cx: [656, 704, 758, 804], cy: [120, 112, 128, 120] }}
          transition={{ ...flowTransition, delay: 0.72 }}
        />

        {nodes.map((node, index) => {
          const x = [80, 350, 650, 810][index] ?? 80;
          const width = index === 3 ? 80 : 120;
          return (
            <g key={node.key}>
              <rect
                x={x}
                y={80}
                width={width}
                height={80}
                rx="16"
                fill="rgba(39,39,42,0.78)"
                stroke="rgba(255,255,255,0.12)"
              />
              <text x={x + 10} y={106} fill="#f3f4f6" fontSize="12">
                {node.label}
              </text>
              <text
                x={x + 10}
                y={134}
                fill="#fbbf24"
                fontSize="22"
                fontWeight="700"
              >
                {node.count}
              </text>
              <text x={x + 10} y={152} fill="#cbd5e1" fontSize="11">
                {getStageDetail(node)}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="grid grid-cols-1 gap-3 md:hidden">
        {nodes.map((node) => (
          <motion.div
            key={node.key}
            whileHover={{ y: -2, scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            transition={{ type: 'spring', stiffness: 340, damping: 26 }}
          >
            <Link
              href={node.href}
              className="block rounded-xl border border-white/10 bg-white/[0.035] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]"
            >
              <p className="text-xs text-white/60">{node.label}</p>
              <p className="mt-1 text-xl font-semibold">{node.count}</p>
              <p className="mt-1 text-sm text-amber-300">
                {getStageDetail(node)}
              </p>
            </Link>
          </motion.div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {nodes.map((node) => (
          <motion.div
            key={`${node.key}-link`}
            whileHover={{ y: -2 }}
            transition={{ type: 'spring', stiffness: 340, damping: 28 }}
          >
            <Link
              href={node.href}
              className="block rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2 text-sm transition-colors hover:border-white/20 hover:bg-white/[0.06]"
            >
              <p className="text-white/70">{node.label}</p>
              <p className="mt-1 font-semibold text-amber-300">
                {getStageDetail(node)}
              </p>
            </Link>
          </motion.div>
        ))}
      </div>
      <p className="mt-3 text-xs tracking-[0.18em] text-amber-300 uppercase">
        Energy Flow Pipeline
      </p>
    </motion.div>
  );
}
