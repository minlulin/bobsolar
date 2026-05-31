import { dehydrate, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { getInventoryItems } from "@/actions/inventory-actions";
import { getSuppliers } from "@/actions/supplier-actions";
import { inventoryKeys, supplierKeys } from "@/lib/query-keys";
import { NewPurchasePageHydrated } from "./new-purchase-page-hydrated";

export const metadata: Metadata = {
  title: "Create Purchase Order",
};

export default async function NewPurchasePage(): Promise<React.JSX.Element> {
  const queryClient = new QueryClient();

  const [suppliers, inventory] = await Promise.all([
    getSuppliers(),
    getInventoryItems({ limit: 50 }),
  ]);

  if (suppliers.success) {
    queryClient.setQueryData(supplierKeys.all, suppliers.data);
  }
  if (inventory.success) {
    queryClient.setQueryData(inventoryKeys.list({ limit: 50 }), inventory.data);
  }

  const dehydratedState = dehydrate(queryClient);

  return <NewPurchasePageHydrated state={dehydratedState} />;
}
