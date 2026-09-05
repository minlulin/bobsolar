"use client";

import { AlertCircle, ChevronLeft, ChevronRight, Search, UserPlus, Users } from "lucide-react";
import { motion } from "motion/react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { startTransition, useOptimistic, useState } from "react";
import { toast } from "sonner";
import { deleteCustomer } from "@/actions/customer-actions";
import { CustomerCard } from "@/components/customers/customer-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/use-debounce";
import type { Customer } from "@/lib/db/schema";
import { staggerContainer } from "@/lib/motion";

const CustomerDialog = dynamic(
  () => import("@/components/customers/customer-dialog").then((mod) => mod.CustomerDialog),
  { ssr: false },
);

import { ListGridSkeleton } from "@/components/skeletons/list-grid-skeleton";
import { useCustomers } from "@/hooks/use-customers";

const PAGE_SIZE = 50;

export function CustomersPageClient({
  initialData,
}: {
  initialData: { items: Customer[]; total: number };
}): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const pageParam = Number(searchParams.get("page") ?? "1");
  const currentPage = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const {
    data: response,
    isLoading,
    isError,
    error,
  } = useCustomers(
    { search: debouncedSearch, page: currentPage, limit: PAGE_SIZE },
    // Only use initialData if there is no search query active and we are on page 1.
    debouncedSearch === "" && currentPage === 1 ? initialData : undefined,
  );

  const handleEdit = (customer: Customer): void => {
    setEditingCustomer(customer);
    setDialogOpen(true);
  };

  const handleAddNew = (): void => {
    setEditingCustomer(null);
    setDialogOpen(true);
  };

  const customers = response?.items ?? [];
  const total = response?.total ?? 0;
  const hasPrevious = currentPage > 1;
  const hasNext = currentPage * PAGE_SIZE < total;

  const navigatePage = (nextPage: number): void => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(nextPage));
    router.push(`/customers?${params.toString()}`);
  };
  const [optimisticCustomers, removeOptimisticCustomer] = useOptimistic(
    customers,
    (state: Customer[], removedId: string) => state.filter((customer) => customer.id !== removedId),
  );

  const handleDelete = (id: string) => {
    startTransition(async () => {
      removeOptimisticCustomer(id);
      const res = await deleteCustomer(id);
      if (!res.success) {
        toast.error(res.error || "Failed to delete customer");
      }
    });
  };

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="surface-panel flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <h1 className="font-heading text-foreground text-3xl font-bold tracking-tight">
            Customers
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage your client base and their service history.
          </p>
        </div>
        <Button onClick={handleAddNew} className="solar-cta">
          <UserPlus className="mr-2 h-4 w-4" />
          Add Customer
        </Button>
      </div>

      {/* Filters Section */}
      <div className="surface-panel-muted relative flex flex-col gap-4 rounded-2xl border p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search customers by name, phone or email..."
            className="bg-background/80 pl-10"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
            }}
          />
        </div>
      </div>

      {/* Content Section */}
      {isLoading ? (
        <ListGridSkeleton count={9} />
      ) : isError ? (
        <div className="border-destructive/50 bg-destructive/5 flex flex-col items-center justify-center rounded-2xl border py-24 text-center">
          <div className="bg-destructive/10 mb-4 rounded-full p-4">
            <AlertCircle className="text-destructive h-12 w-12" />
          </div>
          <h3 className="text-xl font-semibold text-destructive">Failed to load customers</h3>
          <p className="text-muted-foreground mt-2 max-w-xs">
            {error?.message ?? "An unexpected error occurred while fetching customers."}
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
      ) : optimisticCustomers.length > 0 ? (
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {optimisticCustomers.map((customer) => (
            <CustomerCard
              key={customer.id}
              customer={customer}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </motion.div>
      ) : (
        <div className="border-border/60 bg-muted/35 flex flex-col items-center justify-center rounded-2xl border border-dashed py-24 text-center">
          <div className="text-muted-foreground bg-background/70 border-border/60 flex h-20 w-20 items-center justify-center rounded-2xl border">
            <Users className="h-10 w-10 opacity-20" />
          </div>
          <h3 className="text-foreground mt-6 text-xl font-semibold">No customers found</h3>
          <p className="text-muted-foreground mt-2 max-w-xs">
            {search
              ? "We couldn't find any customers matching your search criteria."
              : "You haven't added any customers yet. Start by creating your first client profile."}
          </p>
          {!search && (
            <Button
              variant="link"
              className="text-solar hover:text-solar/80 mt-4"
              onClick={handleAddNew}
            >
              Add your first customer
            </Button>
          )}
        </div>
      )}

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-xs font-medium">
            Page {currentPage} · {total} customers
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!hasPrevious}
              onClick={() => {
                navigatePage(currentPage - 1);
              }}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasNext}
              onClick={() => {
                navigatePage(currentPage + 1);
              }}
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Dialogs */}
      {dialogOpen && (
        <CustomerDialog customer={editingCustomer} open={dialogOpen} onOpenChange={setDialogOpen} />
      )}
    </div>
  );
}
