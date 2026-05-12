'use client';

import Link from 'next/link';
import * as React from 'react';
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

// Organic Flow transition
const flowTransition = {
  duration: 2.65,
  repeat: Number.POSITIVE_INFINITY,
  ease: 'easeInOut',
} satisfies Transition;

// --- Cinematic Energy Orb Component ---
function CinematicEnergyOrb() {
  return (
    <div className="relative w-48 h-48 flex items-center justify-center">
      {/* 1. Outer Halo (Indigo/Ambient) - Slow rotation */}
      <motion.div
        className="absolute inset-0 rounded-full blur-[30px] opacity-20"
        style={{
          background: 'radial-gradient(circle, oklch(0.573 0.233 277.117 / 0.8) 0%, transparent 70%)',
        }}
        animate={{ rotate: 360, scale: [0.95, 1.05, 0.95] }}
        transition={{ rotate: { duration: 20, repeat: Infinity, ease: 'linear' }, scale: { duration: 8, repeat: Infinity, ease: 'easeInOut' } }}
      />

      {/* 2. Mid-Corona (Emerald/Flow) - Breathing */}
      <motion.div
        className="absolute inset-4 rounded-full blur-[15px] opacity-60 mix-blend-screen"
        style={{
          background: 'radial-gradient(circle, oklch(0.723 0.219 165.829 / 1) 0%, transparent 60%)',
        }}
        animate={{ scale: [0.9, 1.1, 0.9] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* 3. The Core (Solar Amber) - Intense & Solid */}
      <motion.div
        className="absolute inset-10 rounded-full"
        style={{
          background: 'radial-gradient(circle at 30% 30%, oklch(0.9 0.1 70) 0%, oklch(0.769 0.188 70.08) 50%, oklch(0.6 0.2 50) 100%)',
          boxShadow: '0 0 60px 20px rgba(var(--color-solar-amber), 0.4), inset 0 0 30px 5px rgba(255, 255, 255, 0.8)',
        }}
        animate={{
          filter: ["brightness(1) blur(2px)", "brightness(1.2) blur(4px)", "brightness(1) blur(2px)"]
        }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        {/* Core Surface Texture (Noise) */}
        <div className="absolute inset-0 rounded-full opacity-30 mix-blend-overlay"
             style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}
        />
      </motion.div>

      {/* 4. Radiating Particles */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 rounded-full bg-[oklch(0.769_0.188_70.08)] shadow-[0_0_10px_rgba(var(--color-solar-amber),1)] blur-[1px]"
          initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
          animate={{
            opacity: [0, 1, 0],
            scale: [0, 1.5, 0],
            x: Math.cos(i * 60 * (Math.PI / 180)) * 100,
            y: Math.sin(i * 60 * (Math.PI / 180)) * 100,
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            delay: i * 0.5,
            ease: "easeOut"
          }}
        />
      ))}
    </div>
  );
}

export function EnergyFlow({ stages }: EnergyFlowProps) {
  if (!stages || stages.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        No pipeline data available.
      </div>
    );
  }

  const maxValue = Math.max(...stages.map((s) => s.value), 1);

  return (
    <div className="relative flex flex-col items-center justify-center p-8 gap-12 overflow-hidden rounded-xl bg-card/10 border border-white/5 backdrop-blur-md">
      {/* Background ambient lighting */}
      <div className="absolute inset-0 bg-gradient-to-b from-[oklch(0.769_0.188_70.08_/_0.05)] to-transparent pointer-events-none" />

      <CinematicEnergyOrb />

      <div className="w-full max-w-2xl relative z-10 flex items-center justify-between">
        {stages.map((stage, idx) => {
          const isLast = idx === stages.length - 1;
          const strokeW = widthFromValue(stage.value, maxValue);

          return (
            <React.Fragment key={stage.key}>
              {/* The Node */}
              <Link href={stage.href} className="group relative flex flex-col items-center outline-none">
                <div className="relative w-12 h-12 flex items-center justify-center rounded-full bg-card border border-border/50 shadow-md group-hover:shadow-[var(--shadow-glow-solar)] group-hover:border-[oklch(0.769_0.188_70.08)] transition-all duration-500">
                   <span className="text-sm font-semibold z-10 group-hover:text-[oklch(0.769_0.188_70.08)] transition-colors">{getStageDetail(stage)}</span>

                   {/* Node Glow on Hover */}
                   <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 bg-[oklch(0.769_0.188_70.08_/_0.1)] transition-opacity duration-500 blur-sm" />
                </div>
                <span className="absolute -bottom-8 text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors whitespace-nowrap">
                  {stage.label}
                </span>
              </Link>

              {/* The Connecting Energy Flow Line */}
              {!isLast && (
                <div className="flex-1 h-12 relative flex items-center group">
                  <svg
                    className="absolute inset-0 w-full h-full"
                    preserveAspectRatio="none"
                    viewBox="0 0 100 100"
                  >
                    {/* Base dim track */}
                    <line
                      x1="0" y1="50" x2="100" y2="50"
                      stroke="currentColor"
                      strokeWidth={strokeW}
                      strokeLinecap="round"
                      className="text-border/30"
                    />
                    {/* Flowing energy pulse */}
                    <motion.line
                      x1="0" y1="50" x2="100" y2="50"
                      stroke="url(#flowGradient)"
                      strokeWidth={strokeW}
                      strokeLinecap="round"
                      initial={{ strokeDasharray: '0 100', strokeDashoffset: 0, opacity: 0 }}
                      animate={{ strokeDasharray: ['0 100', '100 100', '0 100'], strokeDashoffset: [0, -100, 0], opacity: [0, 1, 0] }}
                      transition={flowTransition}
                    />
                    <defs>
                      <linearGradient id="flowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="oklch(0.723 0.219 165.829)" stopOpacity="0" />
                        <stop offset="50%" stopColor="oklch(0.769 0.188 70.08)" stopOpacity="1" />
                        <stop offset="100%" stopColor="oklch(0.573 0.233 277.117)" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
