import { SkeletonCard } from '@/components/shared/skeleton-card';

export default function WarrantyLoading() {
  return (
    <div className="space-y-4">
      <SkeletonCard lines={2} />
      <SkeletonCard lines={2} />
      <SkeletonCard lines={2} />
    </div>
  );
}
