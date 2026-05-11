'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { searchCustomers } from '@/actions/customer-actions';
import { useQuoteBuilderStore } from '@/stores/quote-builder-store';
import { useQuery } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/use-debounce';
import { CustomerDialog } from '@/components/customers/customer-dialog';
import { type Customer } from '@/lib/db/schema';

export function CustomerSelector() {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const debouncedSearch = useDebounce(search, 300);

  const selectedCustomerId = useQuoteBuilderStore(
    (state) => state.selectedCustomerId,
  );
  const setCustomer = useQuoteBuilderStore((state) => state.setCustomer);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers', 'search', debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch && !selectedCustomerId) return [];
      const res = await searchCustomers(debouncedSearch);
      return res.success ? res.data : [];
    },
    enabled: open || !!selectedCustomerId,
  });

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-muted-foreground ml-1 text-sm font-medium">
          Customer
        </label>
        <button
          type="button"
          onClick={() => { setDialogOpen(true); }}
          className="text-xs font-medium text-amber-300 hover:text-amber-200"
        >
          + Add new customer
        </button>
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="bg-background/50 hover:bg-background/80 h-12 w-full justify-between border-white/10 transition-colors"
          >
            <div className="flex items-center gap-2 overflow-hidden">
              <User className="h-4 w-4 shrink-0 text-amber-500" />
              <span className="truncate">
                {selectedCustomer
                  ? selectedCustomer.name
                  : 'Select customer...'}
              </span>
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[--radix-popover-trigger-width] p-0"
          align="start"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search customers..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>
                {isLoading
                  ? 'Searching...'
                  : 'No customer found. Add one, then come back and select.'}
              </CommandEmpty>
              <CommandGroup>
                {customers.map((customer) => (
                  <CommandItem
                    key={customer.id}
                    value={customer.id}
                    onSelect={() => {
                      setCustomer(customer.id);
                      setOpen(false);
                    }}
                    className="flex items-center justify-between"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{customer.name}</span>
                      <span className="text-muted-foreground text-xs">
                        {customer.phone}
                      </span>
                    </div>
                    <Check
                      className={cn(
                        'ml-2 h-4 w-4',
                        selectedCustomerId === customer.id
                          ? 'opacity-100'
                          : 'opacity-0',
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <CustomerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={(customer: Customer) => {
          setCustomer(customer.id);
          setOpen(false);
          setSearch(customer.name);
        }}
      />
    </div>
  );
}
