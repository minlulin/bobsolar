import { SkeletonCard } from "@/components/shared/skeleton-card";

export default function LedgerLoading(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <SkeletonCard lines={3} />
        <SkeletonCard lines={3} />
        <SkeletonCard lines={3} />
      </div>
      <SkeletonCard lines={8} />
    </div>
  );
}
