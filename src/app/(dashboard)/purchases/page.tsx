import { AlertCircle, Plus } from "lucide-react";
import Link from "next/link";
import { getPurchaseOrders } from "@/actions/purchase-actions";
import { Button } from "@/components/ui/button";
import { PurchasesGridClient } from "./components/purchases-grid-client";

export default async function PurchasesPage() {
  const response = await getPurchaseOrders();

  if (!response.success) {
    return (
      <div className="space-y-8">
        <div className="border-destructive/50 bg-destructive/5 flex flex-col items-center justify-center rounded-2xl border py-24 text-center">
          <div className="bg-destructive/10 mb-4 rounded-full p-4">
            <AlertCircle className="text-destructive h-12 w-12" />
          </div>
          <h3 className="text-xl font-semibold text-destructive">Failed to load purchases</h3>
          <p className="text-muted-foreground mt-2 max-w-xs">{response.error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-foreground text-3xl font-bold tracking-tight">
            Purchases & Warehouse
          </h1>
          <p className="text-muted-foreground">
            Manage purchase orders, receive inbound items, and pay suppliers.
          </p>
        </div>
        <Button asChild className="solar-cta">
          <Link href="/purchases/new">
            <Plus className="mr-2 h-4 w-4" />
            New Purchase Order
          </Link>
        </Button>
      </div>

      <PurchasesGridClient initialPurchases={response.data} />
    </div>
  );
}
