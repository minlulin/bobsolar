import { dehydrate, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import type React from "react";
import { getPaymentMethods } from "@/actions/payment-actions";
import { getPurchaseOrderById } from "@/actions/purchase-actions";
import { financeKeys, purchaseKeys } from "@/lib/query-keys";
import { PurchaseDetailPageHydrated } from "./purchase-detail-page-hydrated";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return { title: `Purchase Order ${id}` };
}

export default async function PurchaseDetailPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;
  const queryClient = new QueryClient();

  const [purchase, methods] = await Promise.all([getPurchaseOrderById(id), getPaymentMethods()]);

  if (purchase.success) {
    queryClient.setQueryData(purchaseKeys.detail(id), purchase.data);
  }
  if (methods.success) {
    queryClient.setQueryData([...financeKeys.all, "methods"] as const, methods.data);
  }

  const dehydratedState = dehydrate(queryClient);

  return <PurchaseDetailPageHydrated state={dehydratedState} purchaseId={id} />;
}
