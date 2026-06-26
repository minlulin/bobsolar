"use client";

import type * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface ListGridSkeletonProps {
  count?: number;
}

export function ListGridSkeleton({ count = 12 }: ListGridSkeletonProps): React.JSX.Element {
  return (
    <div className="divide-y divide-border/40 rounded-lg border border-border/40 bg-card/30">
      {Array.from({ length: count }).map((_, index) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: Skeleton has no stable identifier
          key={`skeleton-${index}`}
          className="flex items-center gap-3 px-3 py-2.5"
        >
          <Skeleton className="h-8 w-8 shrink-0 rounded-md" />
          <div className="min-w-0 flex-1">
            <Skeleton className="mb-1 h-4 w-36" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-4 w-20 shrink-0" />
        </div>
      ))}
    </div>
  );
}
