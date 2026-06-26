"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { InventoryCard } from "@/components/inventory/inventory-card";
import { useInventoryItems } from "@/hooks/use-inventory";

const InventoryDialog = dynamic(
  () => import("@/components/inventory/inventory-dialog").then((mod) => mod.InventoryDialog),
  { ssr: false },
);

import { PackageSearch, Plus, Search } from "lucide-react";
import { motion } from "motion/react";
import { ListGridSkeleton } from "@/components/skeletons/list-grid-skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { InventoryItem } from "@/lib/db/schema";
import { staggerContainer } from "@/lib/motion";
import { cn } from "@/lib/utils";

type InventoryPageClientProps = {
  canEdit: boolean;
};

export function InventoryPageClient({ canEdit }: InventoryPageClientProps): React.JSX.Element {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  const {
    data: response,
    isLoading,
    isError,
    error,
  } = useInventoryItems({
    search,
    category: category as
      | "panel"
      | "inverter"
      | "battery"
      | "mounting"
      | "cable"
      | "accessory"
      | "protection"
      | undefined,
    limit: 50,
  });

  const handleEdit = (item: InventoryItem): void => {
    setEditingItem(item);
    setIsDialogOpen(true);
  };

  const handleAddNew = (): void => {
    setEditingItem(null);
    setIsDialogOpen(true);
  };

  const categories = [
    "all",
    "panel",
    "inverter",
    "battery",
    "mounting",
    "cable",
    "accessory",
    "protection",
  ];

  return (
    <div className="space-y-6 pb-20">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Item Catalog</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Component prices and specifications
          </p>
        </div>
        {canEdit && (
          <Button onClick={handleAddNew} size="sm" className="solar-cta">
            <Plus className="mr-1.5 h-3.5 w-3.5 transition-transform group-hover:rotate-90" />
            Add Item
          </Button>
        )}
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
          <Input
            placeholder="Search items, brands, models..."
            className="glass h-9 pl-9 text-sm"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
            }}
          />
        </div>

        <div className="scrollbar-hide flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {categories.map((cat) => (
            <button
              type="button"
              key={cat}
              onClick={() => {
                setCategory(cat === "all" ? null : cat);
              }}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium whitespace-nowrap transition-all",
                category === cat || (cat === "all" && category === null)
                  ? "bg-solar text-white shadow-sm"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted/70",
              )}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <ListGridSkeleton count={12} />
      ) : isError ? (
        <div className="glass flex flex-col items-center justify-center rounded-xl border-destructive/50 py-20 text-center">
          <div className="bg-destructive/10 mb-3 rounded-full p-3">
            <PackageSearch className="text-destructive h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold text-destructive">Failed to load inventory</h3>
          <p className="text-muted-foreground mt-1.5 max-w-xs text-sm">
            {error?.message ?? "An unexpected error occurred while fetching inventory items."}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => {
              setSearch("");
              setCategory(null);
            }}
          >
            Reset Filters & Retry
          </Button>
        </div>
      ) : response && response.items.length > 0 ? (
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="divide-y divide-border/40 rounded-lg border border-border/40 bg-card/30"
        >
          {response.items.map((item) => (
            <InventoryCard key={item.id} item={item} canEdit={canEdit} onEdit={handleEdit} />
          ))}
        </motion.div>
      ) : (
        <div className="glass flex flex-col items-center justify-center rounded-xl border-dashed py-20 text-center">
          <div className="bg-muted/20 mb-3 rounded-full p-3">
            <PackageSearch className="text-muted-foreground h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold">No items found</h3>
          <p className="text-muted-foreground mt-1.5 max-w-xs text-sm">
            We couldn't find any items matching your search or filters.
          </p>
          <Button
            variant="link"
            size="sm"
            className="text-solar-amber mt-3"
            onClick={() => {
              setSearch("");
              setCategory(null);
            }}
          >
            Clear all filters
          </Button>
        </div>
      )}

      {canEdit && isDialogOpen && (
        <InventoryDialog item={editingItem} open={isDialogOpen} onOpenChange={setIsDialogOpen} />
      )}
    </div>
  );
}
