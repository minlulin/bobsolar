import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';

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
import { toast } from 'sonner';

type ActionData<T> = T extends { data: infer D } ? D : never;

type InventoryItemsData = ActionData<Awaited<ReturnType<typeof import('@/actions/inventory-actions').getInventoryItems>>>;

type InventoryItemData = ActionData<Awaited<ReturnType<typeof import('@/actions/inventory-actions').getInventoryItem>>>;

export function useInventoryItems(
  filters: InventoryFilter = {},
): UseQueryResult<InventoryItemsData> {
  return useQuery({

    queryKey: ['inventory', filters],
    queryFn: async () => {
      const res = await getInventoryItems(filters);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useInventoryItem(id: string): UseQueryResult<InventoryItemData> {
  return useQuery({

    queryKey: ['inventory', id],
    queryFn: async () => {
      const res = await getInventoryItem(id);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}


export function useCreateInventoryItem() {
  const queryClient = useQueryClient();


  return useMutation({
    mutationFn: createInventoryItem,
    onSuccess: (response) => {
      if (response.success) {
        queryClient.invalidateQueries({ queryKey: ['inventory'] });
        toast.success('Item created successfully');
      } else {
        toast.error(response.error);
      }
    },
    onError: () => {
      toast.error('Failed to create item');
    },
  });
}

export function useUpdateInventoryItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<CreateInventoryItem>;
    }) => updateInventoryItem(id, data),
    onSuccess: (response) => {
      if (response.success) {
        queryClient.invalidateQueries({ queryKey: ['inventory'] });
        toast.success('Item updated successfully');
      } else {
        toast.error(response.error);
      }
    },
    onError: () => {
      toast.error('Failed to update item');
    },
  });
}

export function useDeleteInventoryItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteInventoryItem,
    onSuccess: (response) => {
      if (response.success) {
        queryClient.invalidateQueries({ queryKey: ['inventory'] });
        toast.success('Item deleted successfully');
      } else {
        toast.error(response.error);
      }
    },
    onError: () => {
      toast.error('Failed to delete item');
    },
  });
}

export function useBulkUpdatePrices() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: bulkUpdatePrices,
    onSuccess: (response) => {
      if (response.success) {
        queryClient.invalidateQueries({ queryKey: ['inventory'] });
        toast.success('Prices updated successfully');
      } else {
        toast.error(response.error);
      }
    },
    onError: () => {
      toast.error('Failed to update prices');
    },
  });
}
