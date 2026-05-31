"use client";

import { type DehydratedState, HydrationBoundary } from "@tanstack/react-query";
import SettingsPage from "./settings-page-client";

export function SettingsPageHydrated({ state }: { state: DehydratedState }): React.JSX.Element {
  return (
    <HydrationBoundary state={state}>
      <SettingsPage />
    </HydrationBoundary>
  );
}
