"use client";

import { type DehydratedState, HydrationBoundary } from "@tanstack/react-query";
import SuppliersPage from "./suppliers-page-client";

export function SuppliersPageHydrated({ state }: { state: DehydratedState }): React.JSX.Element {
  return (
    <HydrationBoundary state={state}>
      <SuppliersPage />
    </HydrationBoundary>
  );
}
