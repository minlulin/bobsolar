import { SkeletonCard } from "@/components/shared/skeleton-card";

export default function TrialBalanceLoading(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <SkeletonCard lines={8} />
    </div>
  );
}
