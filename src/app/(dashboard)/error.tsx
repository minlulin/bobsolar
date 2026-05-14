'use client';

import { useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.JSX.Element {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('[Dashboard Error Boundary]', error);
  }, [error]);

  return (
    <div className="flex h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10">
        <AlertCircle className="h-10 w-10 text-red-500" />
      </div>
      <h2 className="text-foreground mb-2 text-2xl font-bold">
        Something went wrong!
      </h2>
      <p className="text-muted-foreground mb-8 max-w-md">
        We encountered an unexpected error while loading this page. Our team has
        been notified.
      </p>
      <div className="flex gap-4">
        <Button
          onClick={() => {
            reset();
          }}
          className="bg-white font-medium text-black hover:bg-white/90"
        >
          Try again
        </Button>
        <Button
          variant="outline"
          onClick={() => (window.location.href = '/')}
          className="border-border/70 hover:bg-muted/45"
        >
          Go to Dashboard
        </Button>
      </div>
    </div>
  );
}
