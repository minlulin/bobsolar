import { AlertCircle, Plus, Search, Store } from "lucide-react";
import { motion } from "motion/react";
import dynamic from "next/dynamic";
import { useMemo, useOptimistic, useState } from "react";
import { ListGridSkeleton } from "@/components/skeletons/list-grid-skeleton";
import { SupplierCard } from "@/components/suppliers/supplier-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSuppliers } from "@/hooks/use-suppliers";
import type { Supplier } from "@/lib/db/schema";
import { staggerContainer } from "@/lib/motion";

const SupplierDialog = dynamic(
  () => import("@/components/suppliers/supplier-dialog").then((mod) => mod.SupplierDialog),
  { ssr: false },
);

export default function SuppliersPage(): React.JSX.Element {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const { data: suppliersData, isLoading, isError, error } = useSuppliers();

  const handleEdit = (supplier: Supplier): void => {
    setEditingSupplier(supplier);
    setDialogOpen(true);
  };

  const handleAddNew = (): void => {
    setEditingSupplier(null);
    setDialogOpen(true);
  };

  const suppliers = suppliersData ?? [];
  const filteredSuppliers = useMemo(() => {
    if (!search) return suppliers;
    const term = search.toLowerCase();
    return suppliers.filter((s) => {
      return (
        s.name.toLowerCase().includes(term) ||
        (s.companyName?.toLowerCase() || "").includes(term) ||
        (s.phone || "").includes(term)
      );
    });
  }, [suppliers, search]);

  const [optimisticSuppliers, removeOptimisticSupplier] = useOptimistic(
    filteredSuppliers,
    (state: Supplier[], removedId: string) => state.filter((supplier) => supplier.id !== removedId),
  );

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-foreground text-3xl font-bold tracking-tight">
            Suppliers
          </h1>
          <p className="text-muted-foreground">Manage your vendors and monitor accounts payable.</p>
        </div>
        <Button onClick={handleAddNew} className="solar-cta">
          <Plus className="mr-2 h-4 w-4" />
          Add Supplier
        </Button>
      </div>

      {/* Filters Section */}
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search suppliers by name, company, or phone..."
            className="pl-10"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
            }}
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
          <h3 className="text-xl font-semibold text-destructive">Failed to load suppliers</h3>
          <p className="text-muted-foreground mt-2 max-w-xs">
            {error?.message ?? "An unexpected error occurred while fetching suppliers."}
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
      ) : optimisticSuppliers.length > 0 ? (
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {optimisticSuppliers.map((supplier) => (
            <SupplierCard
              key={supplier.id}
              supplier={supplier}
              onEdit={handleEdit}
              onDelete={removeOptimisticSupplier}
            />
          ))}
        </motion.div>
      ) : (
        <div className="border-border/60 bg-muted/45 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed py-24 text-center">
          <div className="text-muted-foreground bg-muted/45 flex h-20 w-20 items-center justify-center rounded-full">
            <Store className="h-10 w-10 opacity-20" />
          </div>
          <h3 className="text-foreground mt-6 text-xl font-semibold">No suppliers found</h3>
          <p className="text-muted-foreground mt-2 max-w-xs">
            {search
              ? "We couldn't find any suppliers matching your search criteria."
              : "You haven't added any suppliers yet. Start by creating your first vendor profile."}
          </p>
          {!search && (
            <Button
              variant="link"
              className="text-solar hover:text-solar/80 mt-4"
              onClick={handleAddNew}
            >
              Add your first supplier
            </Button>
          )}
        </div>
      )}

      {/* Dialogs */}
      {dialogOpen && (
        <SupplierDialog supplier={editingSupplier} open={dialogOpen} onOpenChange={setDialogOpen} />
      )}
    </div>
  );
}
