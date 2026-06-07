"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, User } from "lucide-react";
import dynamic from "next/dynamic";
import * as React from "react";
import { getCustomers, searchCustomers } from "@/actions/customer-actions";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDebounce } from "@/hooks/use-debounce";
import type { Customer } from "@/lib/db/schema";
import { customerKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { useQuoteBuilderStore } from "@/stores/quote-builder-store";

const CustomerDialog = dynamic(
  () => import("@/components/customers/customer-dialog").then((mod) => mod.CustomerDialog),
  { ssr: false },
);

export function CustomerSelector(): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const debouncedSearch = useDebounce(search, 300);

  const selectedCustomerId = useQuoteBuilderStore((state) => state.selectedCustomerId);
  const setCustomer = useQuoteBuilderStore((state) => state.setCustomer);

  const hasSearch = debouncedSearch.length > 0;

  const { data: customers = [], isPending } = useQuery({
    queryKey: hasSearch ? customerKeys.search(debouncedSearch) : customerKeys.list({ limit: 10 }),
    queryFn: async () => {
      if (hasSearch) {
        const res = await searchCustomers(debouncedSearch);
        return res.success ? res.data : [];
      }
      const res = await getCustomers({ limit: 10 });
      return res.success ? res.data.items : [];
    },
    enabled: open || !!selectedCustomerId,
    staleTime: 30 * 1000,
  });

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label
          htmlFor="customer-selector"
          className="text-muted-foreground ml-1 text-sm font-medium"
        >
          Customer
        </label>
        <button
          type="button"
          onClick={() => {
            setDialogOpen(true);
          }}
          className="text-xs font-medium text-amber-300 hover:text-amber-200"
        >
          + Add new customer
        </button>
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="customer-selector"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="bg-background/50 border-border/70 hover:bg-background/80 h-12 w-full justify-between transition-colors"
          >
            <div className="flex items-center gap-2 overflow-hidden">
              <User className="h-4 w-4 shrink-0 text-amber-500" />
              <span className="truncate">
                {selectedCustomer ? selectedCustomer.name : "Select customer..."}
              </span>
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search customers..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>
                {isPending
                  ? "Searching..."
                  : "No customer found. Add one, then come back and select."}
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
                      <span className="text-muted-foreground text-xs">{customer.phone}</span>
                    </div>
                    <Check
                      className={cn(
                        "ml-2 h-4 w-4",
                        selectedCustomerId === customer.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {dialogOpen && (
        <CustomerDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSaved={(customer: Customer) => {
            setCustomer(customer.id);
            setOpen(false);
            setSearch(customer.name);
          }}
        />
      )}
    </div>
  );
}
