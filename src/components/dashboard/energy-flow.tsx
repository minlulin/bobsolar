'use client';

import { motion } from 'framer-motion';

export function EnergyFlow() {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-amber-500/20 bg-gradient-to-br from-zinc-950 via-zinc-900 to-amber-950/50 p-6">
      <svg viewBox="0 0 900 240" className="h-[220px] w-full">
        <rect x="40" y="110" width="180" height="90" rx="12" fill="#1f2937" />
        <rect x="60" y="130" width="55" height="45" rx="4" fill="#0ea5e9" />
        <rect x="125" y="130" width="55" height="45" rx="4" fill="#0ea5e9" />
        <rect x="600" y="85" width="170" height="120" rx="14" fill="#1f2937" />
        <polygon points="585,95 685,40 785,95" fill="#374151" />
        <rect x="360" y="100" width="110" height="120" rx="12" fill="#334155" />
        <path
          d="M220 155 C300 155, 320 155, 360 155"
          stroke="#f59e0b"
          strokeWidth="6"
          fill="none"
        />
        <path
          d="M470 155 C540 155, 560 145, 600 145"
          stroke="#f59e0b"
          strokeWidth="6"
          fill="none"
        />
        <motion.circle
          r="7"
          fill="#fbbf24"
          animate={{ cx: [230, 350], cy: [155, 155] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
        />
        <motion.circle
          r="7"
          fill="#fbbf24"
          animate={{ cx: [480, 590], cy: [155, 145] }}
          transition={{
            duration: 1.6,
            repeat: Infinity,
            ease: 'linear',
            delay: 0.3,
          }}
        />
      </svg>
      <p className="mt-2 text-xs tracking-[0.2em] text-amber-300 uppercase">
        Live Energy Flow
      </p>
    </div>
  );
}
