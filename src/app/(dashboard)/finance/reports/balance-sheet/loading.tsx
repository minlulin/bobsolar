import { SkeletonCard } from "@/components/shared/skeleton-card";

export default function BalanceSheetLoading(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <SkeletonCard lines={6} />
        <SkeletonCard lines={6} />
      </div>
    </div>
  );
}
