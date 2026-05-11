import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getWarrantyAlerts,
  getWarrantySummary,
  resolveWarrantyAlert,
  reopenWarrantyAlert,
} from '@/actions/warranty-actions';
import type { WarrantyListFilter } from '@/lib/validators/warranty';
import { toast } from 'sonner';

type ActionData<T> = T extends { data: infer D } ? D : never;

export function useWarrantySummary(): ReturnType<typeof useQuery<
  ActionData<Awaited<ReturnType<typeof getWarrantySummary>>>
>> {
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

export function useWarrantyAlerts(
  filter: Partial<WarrantyListFilter> = {},
): ReturnType<typeof useQuery<ActionData<Awaited<ReturnType<typeof getWarrantyAlerts>>>>> {
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

export function useResolveWarrantyAlert(): ReturnType<typeof useMutation<
  Awaited<ReturnType<typeof resolveWarrantyAlert>>,
  Error,
  Parameters<typeof resolveWarrantyAlert>[0]
>> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: resolveWarrantyAlert,
    onSuccess: async (res) => {
      if (!res.success) toast.error(res.error);
      else {
        await queryClient.invalidateQueries({ queryKey: ['warranty'] });
        await queryClient.invalidateQueries({ queryKey: ['projects'] });
        toast.success('Alert resolved');
      }
    },
    onError: () => {
      toast.error('Could not resolve');
    },
  });
}

export function useReopenWarrantyAlert(): ReturnType<typeof useMutation<
  Awaited<ReturnType<typeof reopenWarrantyAlert>>,
  Error,
  Parameters<typeof reopenWarrantyAlert>[0]
>> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: reopenWarrantyAlert,
    onSuccess: async (res) => {
      if (!res.success) toast.error(res.error);
      else {
        await queryClient.invalidateQueries({ queryKey: ['warranty'] });
        toast.success('Alert reopened');
      }
    },
    onError: () => {
      toast.error('Could not reopen');
    },
  });
}
