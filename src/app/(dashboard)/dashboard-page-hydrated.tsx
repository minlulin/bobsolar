"use client";

import { type DehydratedState, HydrationBoundary } from "@tanstack/react-query";
import DashboardPage from "./dashboard-page-client";

export function DashboardPageHydrated({ state }: { state: DehydratedState }): React.JSX.Element {
  return (
    <HydrationBoundary state={state}>
      <DashboardPage />
    </HydrationBoundary>
  );
}
