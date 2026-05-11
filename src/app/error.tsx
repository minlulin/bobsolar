'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Root Error Boundary]', error);
  }, [error]);

  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full border border-amber-400/30 bg-amber-500/10">
        <AlertTriangle className="h-12 w-12 text-amber-300" />
      </div>
      <h2 className="mb-2 text-3xl font-bold tracking-tight text-white">
        Something went wrong
      </h2>
      <p className="text-muted-foreground mb-8 max-w-md">
        An unexpected error occurred. Please try again or return to the
        dashboard.
      </p>
      <div className="flex gap-3">
        <Button
          onClick={() => { reset(); }}
          className="bg-white font-medium text-black hover:bg-white/90"
        >
          Try Again
        </Button>
        <Button asChild variant="outline" className="border-white/15">
          <Link href="/">Go to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
