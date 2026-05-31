"use client";

import { type DehydratedState, HydrationBoundary } from "@tanstack/react-query";
import PurchaseDetailPage from "./purchase-detail-page-client";

export function PurchaseDetailPageHydrated({
  state,
  purchaseId,
}: {
  state: DehydratedState;
  purchaseId: string;
}): React.JSX.Element {
  return (
    <HydrationBoundary state={state}>
      <PurchaseDetailPage purchaseId={purchaseId} />
    </HydrationBoundary>
  );
}
