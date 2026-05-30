"use client";

import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import * as React from "react";
import { getInventoryItems } from "@/actions/inventory-actions";
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
import { formatInventoryCatalogDescriptor } from "@/lib/domain/inventory";
import { inventoryKeys } from "@/lib/query-keys";
import { formatMMK } from "@/lib/utils";
import { useQuoteBuilderStore } from "@/stores/quote-builder-store";

export function InventorySearch(): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebounce(search, 300);

  const addItem = useQuoteBuilderStore((state) => state.addItem);
  const { data: availabilityData, isLoading: isCheckingInventory } = useQuery({
    queryKey: inventoryKeys.list({ isActive: true, page: 1, limit: 1 }),
    queryFn: () => getInventoryItems({ isActive: true, page: 1, limit: 1 }),
  });

  const { data, isLoading } = useQuery({
    queryKey: inventoryKeys.search(debouncedSearch),
    queryFn: () => getInventoryItems({ search: debouncedSearch, isActive: true }),
    enabled: open,
  });

  const hasInventoryItems =
    availabilityData?.success === true ? availabilityData.data.total > 0 : false;
  const inventoryItems = data?.success ? data.data.items : [];

  return (
    <div className="relative">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            disabled={!hasInventoryItems || isCheckingInventory}
            className="h-12 w-full justify-start gap-2 border-dashed border-emerald-500/20 bg-emerald-500/10 text-emerald-500 transition-all hover:bg-emerald-500/20"
          >
            <Plus className="h-4 w-4" />
            <span>{hasInventoryItems ? "Add Item from Inventory" : "No Inventory Items Yet"}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search items by name, brand, or model..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList className="max-h-[300px]">
              <CommandEmpty>{isLoading ? "Searching..." : "No items found."}</CommandEmpty>
              <CommandGroup>
                {inventoryItems.map((item) => {
                  const descriptor = formatInventoryCatalogDescriptor(item);

                  return (
                    <CommandItem
                      key={item.id}
                      value={item.id}
                      onSelect={() => {
                        addItem(item);
                        setOpen(false);
                        setSearch("");
                      }}
                      className="flex flex-col items-start gap-1.5 p-3"
                    >
                      <div className="flex w-full min-w-0 items-center justify-between gap-3">
                        <span className="truncate text-sm font-semibold">{item.name}</span>
                        <span className="shrink-0 font-mono text-xs font-bold text-emerald-500">
                          {formatMMK(Number(item.unitPrice))}
                        </span>
                      </div>
                      <div className="text-muted-foreground flex w-full min-w-0 items-center justify-between gap-3 text-[10px] tracking-wider uppercase">
                        <span className="truncate">{descriptor}</span>
                        <span
                          className={
                            item.stockQty > 0 ? "shrink-0 text-blue-400" : "shrink-0 text-red-400"
                          }
                        >
                          Stock: {item.stockQty} {item.unit}
                        </span>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
