'use client';

import { useState } from 'react';
import { Search, Loader2, Users, UserPlus } from 'lucide-react';
import { type Customer } from '@/lib/db/schema';
import { motion } from 'framer-motion';
import { staggerContainer } from '@/lib/motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CustomerCard } from '@/components/customers/customer-card';
import { CustomerDialog } from '@/components/customers/customer-dialog';
import { useCustomers } from '@/hooks/use-customers';

export default function CustomersPage() {
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const { data: response, isLoading } = useCustomers({
    search,
    limit: 50,
  });

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setDialogOpen(true);
  };

  const handleAddNew = () => {
    setEditingCustomer(null);
    setDialogOpen(true);
  };

  const customers = response?.success ? response.data.items : [];

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
          className="bg-solar shadow-solar hover:bg-solar/90 text-white"
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
            onChange={(e) => { setSearch(e.target.value); }}
          />
        </div>
      </div>

      {/* Content Section */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="text-solar h-8 w-8 animate-spin" />
        </div>
      ) : customers.length > 0 ? (
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {customers.map((customer) => (
            <CustomerCard
              key={customer.id}
              customer={customer}
              onEdit={handleEdit}
            />
          ))}
        </motion.div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/5 bg-white/5 py-24 text-center">
          <div className="text-muted-foreground flex h-20 w-20 items-center justify-center rounded-full bg-white/5">
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
      <CustomerDialog
        customer={editingCustomer}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
