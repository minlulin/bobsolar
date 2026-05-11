'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

type FeatureErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function FeatureError({
  error,
  reset,
}: FeatureErrorProps): React.JSX.Element {
  useEffect(() => {
    console.error('[Feature Error Boundary]', error);
  }, [error]);

  return (
    <div className="flex h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10">
        <AlertCircle className="h-10 w-10 text-red-500" />
      </div>
      <h2 className="mb-2 text-2xl font-bold text-white">
        Something went wrong!
      </h2>
      <p className="text-muted-foreground mb-8 max-w-md">
        We hit a problem while loading this section. Try again, or return to
        dashboard.
      </p>
      <div className="flex gap-4">
        <Button
          onClick={() => { reset(); }}
          className="bg-white font-medium text-black hover:bg-white/90"
        >
          Try again
        </Button>
        <Button
          asChild
          variant="outline"
          className="border-white/10 hover:bg-white/5"
        >
          <Link href="/">Go to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
