import { dehydrate, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { getWarrantyAlerts, getWarrantySummary } from "@/actions/warranty-actions";
import { warrantyKeys } from "@/lib/query-keys";
import { WarrantyPageHydrated } from "./warranty-page-hydrated";

export const metadata: Metadata = {
  title: "Warranty & Aftersales",
};

export default async function WarrantyPage(): Promise<React.JSX.Element> {
  const queryClient = new QueryClient();

  const [summary, alerts] = await Promise.all([
    getWarrantySummary(),
    getWarrantyAlerts({ tab: "all" }),
  ]);

  if (summary.success) {
    queryClient.setQueryData(warrantyKeys.summary(), summary.data);
  }
  if (alerts.success) {
    queryClient.setQueryData(warrantyKeys.list("all"), alerts.data);
  }

  const dehydratedState = dehydrate(queryClient);

  return <WarrantyPageHydrated state={dehydratedState} />;
}
