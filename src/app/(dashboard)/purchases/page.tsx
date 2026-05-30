"use client";

import { AlertCircle, Plus, Search, ShoppingCart } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { PurchaseCard } from "@/components/purchases/purchase-card";
import { ListGridSkeleton } from "@/components/skeletons/list-grid-skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePurchases } from "@/hooks/use-purchases";
import { staggerContainer } from "@/lib/motion";

export default function PurchasesPage(): React.JSX.Element {
  const [search, setSearch] = useState("");
  const { data: purchases, isLoading, isError, error } = usePurchases();

  const filteredPurchases = (purchases ?? []).filter((p) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      p.poNumber.toLowerCase().includes(term) ||
      (p.supplier?.name.toLowerCase() || "").includes(term)
    );
  });

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

      {/* Filters Section */}
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search purchases by PO number or supplier..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Content Section */}
      {isLoading ? (
        <ListGridSkeleton count={8} />
      ) : isError ? (
        <div className="border-destructive/50 bg-destructive/5 flex flex-col items-center justify-center rounded-2xl border py-24 text-center">
          <div className="bg-destructive/10 mb-4 rounded-full p-4">
            <AlertCircle className="text-destructive h-12 w-12" />
          </div>
          <h3 className="text-xl font-semibold text-destructive">Failed to load purchases</h3>
          <p className="text-muted-foreground mt-2 max-w-xs">
            {error?.message ?? "An unexpected error occurred while fetching purchase orders."}
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => {
              setSearch("");
            }}
          >
            Clear Search & Retry
          </Button>
        </div>
      ) : filteredPurchases.length > 0 ? (
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {filteredPurchases.map((purchase) => (
            <PurchaseCard key={purchase.id} purchase={purchase} />
          ))}
        </motion.div>
      ) : (
        <div className="border-border/60 bg-muted/45 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed py-24 text-center">
          <div className="text-muted-foreground bg-muted/45 flex h-20 w-20 items-center justify-center rounded-full">
            <ShoppingCart className="h-10 w-10 opacity-20" />
          </div>
          <h3 className="text-foreground mt-6 text-xl font-semibold">No purchases found</h3>
          <p className="text-muted-foreground mt-2 max-w-xs">
            {search
              ? "We couldn't find any purchase orders matching your search criteria."
              : "You haven't created any purchase orders yet."}
          </p>
          {!search && (
            <Button variant="link" asChild className="text-solar hover:text-solar/80 mt-4">
              <Link href="/purchases/new">Create your first PO</Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
