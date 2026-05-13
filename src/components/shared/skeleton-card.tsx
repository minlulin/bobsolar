import { Skeleton } from '@/components/ui/skeleton';

type SkeletonCardProps = {
  lines?: number;
};

export function SkeletonCard({
  lines = 3,
}: SkeletonCardProps): React.JSX.Element {
  return (
    <div className="bg-muted/40 border-border/70 rounded-2xl border p-4">
      <Skeleton className="mb-4 h-5 w-1/2 bg-amber-500/20" />
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, index) => (
          <Skeleton
            key={index}
            className="h-4 w-full bg-gradient-to-r from-amber-400/10 via-amber-200/20 to-amber-400/10"
          />
        ))}
      </div>
    </div>
  );
}
