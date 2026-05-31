"use client";

import { Search, ShoppingCart } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { PurchaseCard } from "@/components/purchases/purchase-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PurchaseOrderListRow } from "@/hooks/use-purchases";
import { staggerContainer } from "@/lib/motion";

export function PurchasesGridClient({
  initialPurchases,
}: {
  initialPurchases: PurchaseOrderListRow[];
}) {
  const [search, setSearch] = useState("");

  const filteredPurchases = initialPurchases.filter((p) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      p.poNumber.toLowerCase().includes(term) ||
      (p.supplier?.name.toLowerCase() || "").includes(term)
    );
  });

  return (
    <div className="space-y-8">
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
      {filteredPurchases.length > 0 ? (
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
