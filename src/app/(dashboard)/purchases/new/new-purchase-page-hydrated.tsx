"use client";

import { type DehydratedState, HydrationBoundary } from "@tanstack/react-query";
import NewPurchasePage from "./new-purchase-page-client";

export function NewPurchasePageHydrated({ state }: { state: DehydratedState }): React.JSX.Element {
  return (
    <HydrationBoundary state={state}>
      <NewPurchasePage />
    </HydrationBoundary>
  );
}
