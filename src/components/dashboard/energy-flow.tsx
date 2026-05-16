'use client';

import Link from 'next/link';
import * as React from 'react';
import { motion } from 'motion/react';

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
    <div className="border-border bg-card relative rounded-xl border p-6 pb-12">
      <h3 className="text-foreground mb-10 text-sm font-semibold tracking-wide">
        Pipeline Flow
      </h3>

      <div className="relative z-10 flex w-full items-start justify-between px-4">
        {stages.map((stage, idx) => {
          const isLast = idx === stages.length - 1;
          const strokeW = widthFromValue(stage.value, maxValue);

          return (
            <React.Fragment key={stage.key}>
              <div className="flex flex-col items-center gap-4">
                {/* The Node + Line container */}
                <div className="flex items-center">
                  <Link
                    href={stage.href}
                    className="group border-border bg-card hover:border-solar-amber relative flex h-12 w-12 items-center justify-center rounded-full border shadow-sm transition-all outline-none"
                  >
                    <span className="text-foreground group-hover:text-solar-amber z-10 text-sm font-bold transition-colors">
                      {stage.count.toLocaleString('en-US')}
                    </span>
                    {/* Active pulse effect */}
                    {stage.count > 0 && (
                      <span className="bg-solar-amber/10 absolute inset-0 animate-ping rounded-full" />
                    )}
                  </Link>

                  {/* The Connecting Line (Relative to node) */}
                  {!isLast && (
                    <div className="relative flex h-1 w-12 flex-1 items-center sm:w-24 md:w-32">
                      <div
                        className="bg-border/40 h-full w-full overflow-hidden rounded-full"
                        style={{ height: strokeW / 2 }}
                      >
                        <motion.div
                          initial={{ x: '-100%' }}
                          animate={{ x: '0%' }}
                          transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            ease: 'linear',
                          }}
                          className="via-solar-amber/30 h-full w-full bg-gradient-to-r from-transparent to-transparent"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* The Label */}
                <span className="text-muted-foreground text-[10px] font-bold tracking-widest whitespace-nowrap uppercase">
                  {stage.label}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
