import { type UseQueryResult, useQuery } from "@tanstack/react-query";

import {
  bulkUpdatePrices,
  createInventoryItem,
  deleteInventoryItem,
  getInventoryItem,
  getInventoryItems,
  updateInventoryItem,
} from "@/actions/inventory-actions";
import { createMutationHook } from "@/hooks/mutation-factory";
import type { InventoryItem } from "@/lib/db/schema";
import { inventoryKeys } from "@/lib/query-keys";
import type { CreateInventoryItem, InventoryFilter } from "@/lib/validators/inventory";

type PaginatedItems = { items: InventoryItem[]; total: number };

export function useInventoryItems(
  filters: InventoryFilter = {},
): UseQueryResult<PaginatedItems, Error> {
  return useQuery<PaginatedItems, Error>({
    queryKey: inventoryKeys.list(filters),
    queryFn: async () => {
      const res = await getInventoryItems(filters);
      if (!res.success) throw new Error(res.error);
      if (res.data === undefined) throw new Error("Missing response data");
      return res.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useInventoryItem(id: string): UseQueryResult<InventoryItem, Error> {
  return useQuery<InventoryItem, Error>({
    queryKey: inventoryKeys.detail(id),
    queryFn: async () => {
      const res = await getInventoryItem(id);
      if (!res.success) throw new Error(res.error);
      if (res.data === undefined) throw new Error("Missing response data");
      return res.data;
    },
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

export const useCreateInventoryItem = createMutationHook({
  mutationFn: (data: CreateInventoryItem) => createInventoryItem(data),
  invalidateKeys: [inventoryKeys.all],
  successMessage: "Item created successfully",
  errorMessage: "Failed to create item",
});

export const useUpdateInventoryItem = createMutationHook({
  mutationFn: (args: { id: string; data: Partial<CreateInventoryItem> }) =>
    updateInventoryItem(args.id, args.data),
  invalidateKeys: [inventoryKeys.all],
  successMessage: "Item updated successfully",
  errorMessage: "Failed to update item",
});

export const useDeleteInventoryItem = createMutationHook({
  mutationFn: (id: string) => deleteInventoryItem(id),
  invalidateKeys: [inventoryKeys.all],
  successMessage: "Item deleted successfully",
  errorMessage: "Failed to delete item",
});

export const useBulkUpdatePrices = createMutationHook({
  mutationFn: (items: Array<{ id: string; unitPrice: number }>) => bulkUpdatePrices(items),
  invalidateKeys: [inventoryKeys.all],
  successMessage: "Prices updated successfully",
  errorMessage: "Failed to update prices",
});
