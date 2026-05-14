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
function CinematicEnergyOrb(): React.JSX.Element {
  return (
    <div className="relative flex h-48 w-48 items-center justify-center">
      {/* 1. Outer Halo (Indigo/Ambient) - Slow rotation */}
      <motion.div
        className="absolute inset-0 rounded-full opacity-20 blur-[30px]"
        style={{
          background:
            'radial-gradient(circle, oklch(0.573 0.233 277.117 / 0.8) 0%, transparent 70%)',
        }}
        animate={{ rotate: 360, scale: [0.95, 1.05, 0.95] }}
        transition={{
          rotate: { duration: 20, repeat: Infinity, ease: 'linear' },
          scale: { duration: 8, repeat: Infinity, ease: 'easeInOut' },
        }}
      />

      {/* 2. Mid-Corona (Emerald/Flow) - Breathing */}
      <motion.div
        className="absolute inset-4 rounded-full opacity-60 mix-blend-screen blur-[15px]"
        style={{
          background:
            'radial-gradient(circle, oklch(0.723 0.219 165.829 / 1) 0%, transparent 60%)',
        }}
        animate={{ scale: [0.9, 1.1, 0.9] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* 3. The Core (Solar Amber) - Intense & Solid */}
      <motion.div
        className="absolute inset-10 rounded-full"
        style={{
          background:
            'radial-gradient(circle at 30% 30%, oklch(0.9 0.1 70) 0%, oklch(0.769 0.188 70.08) 50%, oklch(0.6 0.2 50) 100%)',
          boxShadow:
            '0 0 60px 20px rgba(var(--color-solar-amber), 0.4), inset 0 0 30px 5px rgba(255, 255, 255, 0.8)',
        }}
        animate={{
          filter: [
            'brightness(1) blur(2px)',
            'brightness(1.2) blur(4px)',
            'brightness(1) blur(2px)',
          ],
        }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        {/* Core Surface Texture (Noise) */}
        <div
          className="absolute inset-0 rounded-full opacity-30 mix-blend-overlay"
          style={{
            backgroundImage:
              'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")',
          }}
        />
      </motion.div>

      {/* 4. Radiating Particles */}
      {Array.from({ length: 6 }, (_, i) => (
        <motion.div
          key={i}
          className="absolute h-2 w-2 rounded-full bg-[oklch(0.769_0.188_70.08)] shadow-[0_0_10px_rgba(var(--color-solar-amber),1)] blur-[1px]"
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
            ease: 'easeOut',
          }}
        />
      ))}
    </div>
  );
}

export function EnergyFlow({ stages }: EnergyFlowProps): React.JSX.Element {
  if (stages.length === 0) {
    return (
      <div className="text-muted-foreground flex h-48 items-center justify-center">
        No pipeline data available.
      </div>
    );
  }

  const maxValue = Math.max(...stages.map((s) => s.value), 1);

  return (
    <div className="bg-card/10 relative flex flex-col items-center justify-center gap-12 overflow-hidden rounded-xl border border-white/5 p-8 backdrop-blur-md">
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[oklch(0.769_0.188_70.08_/_0.05)] to-transparent" />

      <CinematicEnergyOrb />

      <div className="relative z-10 flex w-full max-w-2xl items-center justify-between">
        {stages.map((stage, idx) => {
          const isLast = idx === stages.length - 1;
          const strokeW = widthFromValue(stage.value, maxValue);

          return (
            <React.Fragment key={stage.key}>
              {/* The Node */}
              <Link
                href={stage.href}
                className="group relative flex flex-col items-center outline-none"
              >
                <div className="bg-card border-border/50 relative flex h-12 w-12 items-center justify-center rounded-full border shadow-md transition-all duration-500 group-hover:border-[oklch(0.769_0.188_70.08)] group-hover:shadow-[var(--shadow-glow-solar)]">
                  <span className="z-10 text-sm font-semibold transition-colors group-hover:text-[oklch(0.769_0.188_70.08)]">
                    {getStageDetail(stage)}
                  </span>

                  {/* Node Glow on Hover */}
                  <div className="absolute inset-0 rounded-full bg-[oklch(0.769_0.188_70.08_/_0.1)] opacity-0 blur-sm transition-opacity duration-500 group-hover:opacity-100" />
                </div>
                <span className="text-muted-foreground group-hover:text-foreground absolute -bottom-8 text-xs font-medium whitespace-nowrap transition-colors">
                  {stage.label}
                </span>
              </Link>

              {/* The Connecting Energy Flow Line */}
              {!isLast && (
                <div className="group relative flex h-12 flex-1 items-center">
                  <svg
                    className="absolute inset-0 h-full w-full"
                    preserveAspectRatio="none"
                    viewBox="0 0 100 100"
                  >
                    {/* Base dim track */}
                    <line
                      x1="0"
                      y1="50"
                      x2="100"
                      y2="50"
                      stroke="currentColor"
                      strokeWidth={strokeW}
                      strokeLinecap="round"
                      className="text-border/30"
                    />
                    {/* Flowing energy pulse */}
                    <motion.line
                      x1="0"
                      y1="50"
                      x2="100"
                      y2="50"
                      stroke="url(#flowGradient)"
                      strokeWidth={strokeW}
                      strokeLinecap="round"
                      initial={{
                        strokeDasharray: '0 100',
                        strokeDashoffset: 0,
                        opacity: 0,
                      }}
                      animate={{
                        strokeDasharray: ['0 100', '100 100', '0 100'],
                        strokeDashoffset: [0, -100, 0],
                        opacity: [0, 1, 0],
                      }}
                      transition={flowTransition}
                    />
                    <defs>
                      <linearGradient
                        id="flowGradient"
                        x1="0%"
                        y1="0%"
                        x2="100%"
                        y2="0%"
                      >
                        <stop
                          offset="0%"
                          stopColor="oklch(0.723 0.219 165.829)"
                          stopOpacity="0"
                        />
                        <stop
                          offset="50%"
                          stopColor="oklch(0.769 0.188 70.08)"
                          stopOpacity="1"
                        />
                        <stop
                          offset="100%"
                          stopColor="oklch(0.573 0.233 277.117)"
                          stopOpacity="0"
                        />
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
