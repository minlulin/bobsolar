"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function WarrantyError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.JSX.Element {
  void error;
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-2xl bg-destructive/10 p-4">
        <AlertTriangle className="text-destructive h-8 w-8" />
      </div>
      <h2 className="font-heading mt-4 text-xl font-bold">Something went wrong</h2>
      <p className="text-muted-foreground mt-2 max-w-sm text-sm">
        Failed to load warranty alerts. Please try again.
      </p>
      <div className="mt-6 flex gap-3">
        <Button variant="outline" onClick={() => reset()}>
          Try Again
        </Button>
        <Button asChild variant="ghost">
          <Link href="/warranty">Back to Warranty</Link>
        </Button>
      </div>
    </div>
  );
}
