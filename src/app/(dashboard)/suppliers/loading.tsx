import { SkeletonCard } from "@/components/shared/skeleton-card";

export default function SuppliersLoading(): React.JSX.Element {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <SkeletonCard lines={4} />
      <SkeletonCard lines={3} />
      <SkeletonCard lines={5} />
      <SkeletonCard lines={3} />
    </div>
  );
}
