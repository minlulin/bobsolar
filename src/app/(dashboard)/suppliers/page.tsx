import { dehydrate, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { getSuppliers } from "@/actions/supplier-actions";
import { supplierKeys } from "@/lib/query-keys";
import { SuppliersPageHydrated } from "./suppliers-page-hydrated";

export const metadata: Metadata = {
  title: "Suppliers",
};

export default async function SuppliersPage(): Promise<React.JSX.Element> {
  const queryClient = new QueryClient();

  const suppliers = await getSuppliers();

  if (suppliers.success) {
    queryClient.setQueryData(supplierKeys.all, suppliers.data);
  }

  const dehydratedState = dehydrate(queryClient);

  return <SuppliersPageHydrated state={dehydratedState} />;
}
