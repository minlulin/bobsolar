'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

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

function widthFromValue(value: number, maxValue: number): number {
  if (maxValue <= 0) return 4;
  return Math.max(4, (value / maxValue) * 14);
}

export function EnergyFlow({ stages }: EnergyFlowProps) {
  const nodes = stages.slice(0, 4);
  const maxValue = Math.max(...nodes.map((n) => n.value), 1);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-amber-500/20 bg-gradient-to-br from-zinc-950 via-zinc-900 to-amber-950/50 p-6">
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
          animate={{ cx: [176, 344], cy: [120, 120] }}
          transition={{ duration: 1.8, repeat: Number.POSITIVE_INFINITY, ease: 'linear' }}
        />
        <motion.circle
          r="6"
          fill="#34d399"
          animate={{ cx: [476, 644], cy: [120, 120] }}
          transition={{ duration: 1.8, repeat: Number.POSITIVE_INFINITY, ease: 'linear', delay: 0.3 }}
        />
        <motion.circle
          r="6"
          fill="#2dd4bf"
          animate={{ cx: [656, 804], cy: [120, 120] }}
          transition={{ duration: 1.8, repeat: Number.POSITIVE_INFINITY, ease: 'linear', delay: 0.6 }}
        />

        {nodes.map((node, index) => {
          const x = [80, 350, 650, 810][index] ?? 80;
          const width = index === 3 ? 80 : 120;
          return (
            <g key={node.key}>
              <rect x={x} y={80} width={width} height={80} rx="12" fill="#1f2937" />
              <text x={x + 10} y={106} fill="#f3f4f6" fontSize="12">
                {node.label}
              </text>
              <text x={x + 10} y={130} fill="#fbbf24" fontSize="18" fontWeight="700">
                {node.count}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="grid grid-cols-1 gap-3 md:hidden">
        {nodes.map((node) => (
          <Link
            key={node.key}
            href={node.href}
            className="rounded-xl border border-white/10 bg-white/[0.02] p-3"
          >
            <p className="text-xs text-white/60">{node.label}</p>
            <p className="mt-1 text-lg font-semibold">{node.count}</p>
          </Link>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {nodes.map((node) => (
          <Link
            key={`${node.key}-link`}
            href={node.href}
            className="rounded-lg border border-white/10 px-3 py-2 text-xs transition-colors hover:bg-white/5"
          >
            <p className="text-white/70">{node.label}</p>
            <p className="mt-1 font-semibold text-amber-300">
              {Math.round(node.value).toLocaleString('en-US')} MMK
            </p>
          </Link>
        ))}
      </div>
      <p className="mt-3 text-xs tracking-[0.18em] text-amber-300 uppercase">
        Energy Flow Pipeline
      </p>
    </div>
  );
}
