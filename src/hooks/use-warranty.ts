import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getWarrantyAlerts,
  getWarrantySummary,
  resolveWarrantyAlert,
  reopenWarrantyAlert,
} from '@/actions/warranty-actions';
import type { WarrantyListFilter } from '@/lib/validators/warranty';
import { toast } from 'sonner';

export function useWarrantySummary() {
  return useQuery({
    queryKey: ['warranty', 'summary'],
    queryFn: async () => {
      const res = await getWarrantySummary();
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    staleTime: 60 * 1000,
  });
}

export function useWarrantyAlerts(filter: Partial<WarrantyListFilter> = {}) {
  const tab = filter.tab ?? 'all';

  return useQuery({
    queryKey: ['warranty', 'alerts', tab],
    queryFn: async () => {
      const res = await getWarrantyAlerts({ tab });
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    staleTime: 30 * 1000,
  });
}

export function useResolveWarrantyAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: resolveWarrantyAlert,
    onSuccess: (res) => {
      if (!res.success) toast.error(res.error);
      else {
        queryClient.invalidateQueries({ queryKey: ['warranty'] });
        queryClient.invalidateQueries({ queryKey: ['projects'] });
        toast.success('Alert resolved');
      }
    },
    onError: () => toast.error('Could not resolve'),
  });
}

export function useReopenWarrantyAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: reopenWarrantyAlert,
    onSuccess: (res) => {
      if (!res.success) toast.error(res.error);
      else {
        queryClient.invalidateQueries({ queryKey: ['warranty'] });
        toast.success('Alert reopened');
      }
    },
    onError: () => toast.error('Could not reopen'),
  });
}
