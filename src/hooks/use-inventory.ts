import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

export function useInventoryItems(filters: InventoryFilter = {}) {
  return useQuery({
    queryKey: ['inventory', filters],
    queryFn: () => getInventoryItems(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useInventoryItem(id: string) {
  return useQuery({
    queryKey: ['inventory', id],
    queryFn: () => getInventoryItem(id),
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
