import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import {
  getInventoryItems,
  getInventoryItem,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  bulkUpdatePrices,
} from '@/actions/inventory-actions';
import {
  type InventoryFilter,
  type CreateInventoryItem,
} from '@/lib/validators/inventory';
import { inventoryKeys } from '@/lib/query-keys';
import { createMutationHook } from '@/hooks/mutation-factory';

export function useInventoryItems(
  filters: InventoryFilter = {},
): UseQueryResult {
  return useQuery({
    queryKey: inventoryKeys.list(filters),
    queryFn: async () => {
      const res = await getInventoryItems(filters);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useInventoryItem(id: string): UseQueryResult {
  return useQuery({
    queryKey: inventoryKeys.detail(id),
    queryFn: async () => {
      const res = await getInventoryItem(id);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

export const useCreateInventoryItem = createMutationHook({
  mutationFn: (data: CreateInventoryItem) => createInventoryItem(data),
  invalidateKeys: [inventoryKeys.all],
  successMessage: 'Item created successfully',
  errorMessage: 'Failed to create item',
});

export const useUpdateInventoryItem = createMutationHook({
  mutationFn: (args: { id: string; data: Partial<CreateInventoryItem> }) =>
    updateInventoryItem(args.id, args.data),
  invalidateKeys: [inventoryKeys.all],
  successMessage: 'Item updated successfully',
  errorMessage: 'Failed to update item',
});

export const useDeleteInventoryItem = createMutationHook({
  mutationFn: (id: string) => deleteInventoryItem(id),
  invalidateKeys: [inventoryKeys.all],
  successMessage: 'Item deleted successfully',
  errorMessage: 'Failed to delete item',
});

export const useBulkUpdatePrices = createMutationHook({
  mutationFn: (items: Array<{ id: string; unitPrice: number }>) =>
    bulkUpdatePrices(items),
  invalidateKeys: [inventoryKeys.all],
  successMessage: 'Prices updated successfully',
  errorMessage: 'Failed to update prices',
});
