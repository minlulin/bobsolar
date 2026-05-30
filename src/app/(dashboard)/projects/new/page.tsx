import { Loader2 } from "lucide-react";
import type * as React from "react";
import { Suspense } from "react";

import { BackButton } from "@/components/shared/back-button";
import { ConversionFlow } from "./components/conversion-flow-client";

export default function ConvertProjectBlueprintPage(): React.JSX.Element {
  return (
    <div className="container mx-auto max-w-5xl px-4 pt-12 pb-36">
      <BackButton />
      <Suspense
        fallback={
          <div className="flex h-[60vh] items-center justify-center">
            <Loader2 className="text-accent h-12 w-12 animate-spin" />
          </div>
        }
      >
        <ConversionFlow />
      </Suspense>
    </div>
  );
}
