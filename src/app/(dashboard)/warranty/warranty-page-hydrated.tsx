"use client";

import { type DehydratedState, HydrationBoundary } from "@tanstack/react-query";
import WarrantyPage from "./warranty-page-client";

export function WarrantyPageHydrated({ state }: { state: DehydratedState }): React.JSX.Element {
  return (
    <HydrationBoundary state={state}>
      <WarrantyPage />
    </HydrationBoundary>
  );
}
