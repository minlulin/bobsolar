import { SkeletonCard } from "@/components/shared/skeleton-card";

export default function NewEntryLoading(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <SkeletonCard lines={4} />
      <SkeletonCard lines={6} />
    </div>
  );
}
