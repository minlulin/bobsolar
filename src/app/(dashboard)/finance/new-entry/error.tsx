"use client";

import { AlertCircle } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function NewEntryError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.JSX.Element {
  useEffect(() => {
    console.error("[New Entry Error Boundary]", error);
  }, [error]);

  return (
    <div className="flex h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10">
        <AlertCircle className="h-10 w-10 text-red-500" />
      </div>
      <h2 className="text-foreground mb-2 text-2xl font-bold">Journal Entry Error</h2>
      <p className="text-muted-foreground mb-8 max-w-md">
        We encountered an error with the journal entry form. Your data may not have been saved.
        Please try again or contact support if the issue persists.
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
          onClick={() => (window.location.href = "/finance/new-entry")}
          className="border-border/70 hover:bg-muted/45"
        >
          Back to New Entry
        </Button>
      </div>
    </div>
  );
}
