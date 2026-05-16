'use client';

import Link from 'next/link';
import * as React from 'react';

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
    <div className="border-border bg-card relative rounded-xl border p-6">
      <h3 className="text-foreground mb-6 text-sm font-semibold tracking-wide">
        Pipeline Flow
      </h3>

      <div className="relative z-10 flex w-full items-center justify-between">
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
                <div className="bg-card border-border group-hover:border-solar relative flex h-12 w-12 items-center justify-center rounded-full border transition-colors">
                  <span className="text-foreground group-hover:text-solar z-10 text-sm font-semibold transition-colors">
                    {stage.count.toLocaleString('en-US')}
                  </span>
                </div>
                <span className="text-muted-foreground group-hover:text-foreground absolute -bottom-8 text-xs font-medium whitespace-nowrap transition-colors">
                  {stage.label}
                </span>
              </Link>

              {/* The Connecting Line */}
              {!isLast && (
                <div className="relative flex h-12 flex-1 items-center">
                  <svg
                    className="absolute inset-0 h-full w-full"
                    preserveAspectRatio="none"
                    viewBox="0 0 100 100"
                  >
                    <line
                      x1="0"
                      y1="50"
                      x2="100"
                      y2="50"
                      stroke="currentColor"
                      strokeWidth={strokeW}
                      strokeLinecap="round"
                      className="text-border"
                    />
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
