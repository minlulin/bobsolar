'use client';

import { useOptimistic, useState } from 'react';
import { Search, Users, UserPlus } from 'lucide-react';
import { type Customer } from '@/lib/db/schema';
import { motion } from 'framer-motion';
import { staggerContainer } from '@/lib/motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import dynamic from 'next/dynamic';
import { CustomerCard } from '@/components/customers/customer-card';

const CustomerDialog = dynamic(
  () =>
    import('@/components/customers/customer-dialog').then(
      (mod) => mod.CustomerDialog,
    ),
  { ssr: false },
);
import { useCustomers } from '@/hooks/use-customers';
import { ListGridSkeleton } from '@/components/skeletons/list-grid-skeleton';

export default function CustomersPage(): React.JSX.Element {
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const { data: response, isLoading } = useCustomers({
    search,
    limit: 50,
  });

  const handleEdit = (customer: Customer): void => {
    setEditingCustomer(customer);
    setDialogOpen(true);
  };

  const handleAddNew = (): void => {
    setEditingCustomer(null);
    setDialogOpen(true);
  };

  const customers = response?.items ?? [];
  const [optimisticCustomers, removeOptimisticCustomer] = useOptimistic(
    customers,
    (state: Customer[], removedId: string) =>
      state.filter((customer) => customer.id !== removedId),
  );

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-foreground text-3xl font-bold tracking-tight">
            Customers
          </h1>
          <p className="text-muted-foreground">
            Manage your client base and their service history.
          </p>
        </div>
        <Button
          onClick={handleAddNew}
          className="bg-solar shadow-solar hover:bg-solar/90 text-foreground"
        >
          <UserPlus className="mr-2 h-4 w-4" />
          Add Customer
        </Button>
      </div>

      {/* Filters Section */}
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search customers by name, phone or email..."
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
        <ListGridSkeleton count={9} />
      ) : optimisticCustomers.length > 0 ? (
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {optimisticCustomers.map((customer) => (
            <CustomerCard
              key={customer.id}
              customer={customer}
              onEdit={handleEdit}
              onDelete={removeOptimisticCustomer}
            />
          ))}
        </motion.div>
      ) : (
        <div className="border-border/60 bg-muted/45 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed py-24 text-center">
          <div className="text-muted-foreground bg-muted/45 flex h-20 w-20 items-center justify-center rounded-full">
            <Users className="h-10 w-10 opacity-20" />
          </div>
          <h3 className="text-foreground mt-6 text-xl font-semibold">
            No customers found
          </h3>
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

      {/* Dialogs */}
      {dialogOpen && (
        <CustomerDialog
          customer={editingCustomer}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />
      )}
    </div>
  );
}
