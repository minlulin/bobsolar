import { SkeletonCard } from "@/components/shared/skeleton-card";

export default function FeatureLoading(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SkeletonCard lines={4} />
        <SkeletonCard lines={3} />
        <SkeletonCard lines={5} />
      </div>
    </div>
  );
}
