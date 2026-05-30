import { SkeletonCard } from "@/components/shared/skeleton-card";

export default function PayableAgingLoading(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <SkeletonCard lines={2} />
        <SkeletonCard lines={2} />
        <SkeletonCard lines={2} />
        <SkeletonCard lines={2} />
        <SkeletonCard lines={2} />
      </div>
      <SkeletonCard lines={6} />
    </div>
  );
}
