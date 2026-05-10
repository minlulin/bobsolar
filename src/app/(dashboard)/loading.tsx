import { Loader2 } from 'lucide-react';

export default function DashboardLoading() {
  return (
    <div className="flex h-[50vh] w-full items-center justify-center">
      <div className="text-muted-foreground flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm">Loading...</p>
      </div>
    </div>
  );
}
