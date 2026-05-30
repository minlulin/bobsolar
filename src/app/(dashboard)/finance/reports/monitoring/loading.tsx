import { SkeletonCard } from "@/components/shared/skeleton-card";

export default function MonitoringLoading(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <SkeletonCard lines={4} />
        <SkeletonCard lines={4} />
      </div>
      <SkeletonCard lines={6} />
    </div>
  );
}
