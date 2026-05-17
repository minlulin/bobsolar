'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Search, User } from 'lucide-react';
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
import { useSearchCustomers } from '@/hooks/use-customers';
import { getCustomer } from '@/actions/customer-actions';
import { type Customer } from '@/lib/db/schema';
import { useDebounce } from '@/hooks/use-debounce';

interface CustomerSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  onCustomerSelect?: (customer: Customer) => void;
}

export function CustomerSelector({
  value,
  onValueChange,
  onCustomerSelect,
}: CustomerSelectorProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const { data: customersData, isLoading } =
    useSearchCustomers(debouncedSearch);
  const customers = customersData ?? [];

  const foundInSearch = customers.find((c) => c.id === value);
  const { data: customerById } = useQuery({
    queryKey: ['customer', 'lookup', value],
    queryFn: async () => {
      const res = await getCustomer(value);
      if (!res.success) return null;
      return { id: res.data.id, name: res.data.name, phone: res.data.phone };
    },
    enabled: !!value && !foundInSearch,
    staleTime: 5 * 60 * 1000,
  });
  const selectedCustomer = foundInSearch ?? customerById ?? null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="border-border/70 bg-muted/45 hover:bg-muted/55 w-full justify-between"
        >
          {selectedCustomer ? (
            <div className="flex items-center gap-2">
              <User className="text-solar h-4 w-4" />
              <span>{selectedCustomer.name}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">Select customer...</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search customer by name or phone..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {isLoading && (
              <div className="flex items-center justify-center p-4">
                <Search className="text-muted-foreground h-4 w-4 animate-pulse" />
              </div>
            )}

            {!isLoading && customers.length === 0 && search.length >= 2 && (
              <CommandEmpty>No customer found.</CommandEmpty>
            )}

            {!isLoading && search.length < 2 && (
              <div className="text-muted-foreground p-4 text-center text-sm">
                Type at least 2 characters to search...
              </div>
            )}

            <CommandGroup>
              {customers.map((customer) => (
                <CommandItem
                  key={customer.id}
                  value={customer.id}
                  onSelect={() => {
                    onValueChange(customer.id);
                    onCustomerSelect?.(customer);
                    setOpen(false);
                  }}
                  className="flex flex-col items-start gap-1 py-3"
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="font-medium">{customer.name}</span>
                    {value === customer.id && (
                      <Check className="text-solar h-4 w-4" />
                    )}
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {customer.phone}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
