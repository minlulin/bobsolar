'use client';

import * as React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface ListGridSkeletonProps {
  count?: number;
}

export function ListGridSkeleton({
  count = 8,
}: ListGridSkeletonProps): React.JSX.Element {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={`skeleton-${index}`}
          className="bg-muted/40 border-border/60 rounded-2xl border p-5"
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
          <Skeleton className="mb-2 h-5 w-40" />
          <Skeleton className="mb-5 h-4 w-28" />
          <Skeleton className="mb-2 h-4 w-full" />
          <Skeleton className="mb-2 h-4 w-11/12" />
          <Skeleton className="h-4 w-9/12" />
        </div>
      ))}
    </div>
  );
}
