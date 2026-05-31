import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getWarrantyAlerts,
  getWarrantySummary,
  reopenWarrantyAlert,
  resolveWarrantyAlert,
} from "@/actions/warranty-actions";
import { STALE_TIME } from "@/lib/query-config";
import { projectKeys, warrantyKeys } from "@/lib/query-keys";
import type { ActionData } from "@/lib/utils/action-response";
import type { WarrantyListFilter } from "@/lib/validators/warranty";

export function useWarrantySummary(): ReturnType<
  typeof useQuery<ActionData<Awaited<ReturnType<typeof getWarrantySummary>>>>
> {
  return useQuery({
    queryKey: warrantyKeys.summary(),
    queryFn: async () => {
      const res = await getWarrantySummary();
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    staleTime: STALE_TIME.MEDIUM,
  });
}

export function useWarrantyAlerts(
  filter: Partial<WarrantyListFilter> = {},
): ReturnType<typeof useQuery<ActionData<Awaited<ReturnType<typeof getWarrantyAlerts>>>>> {
  const tab = filter.tab ?? "all";

  return useQuery({
    queryKey: warrantyKeys.list(tab),
    queryFn: async () => {
      const res = await getWarrantyAlerts({ tab });
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    staleTime: STALE_TIME.SHORT,
  });
}

export function useResolveWarrantyAlert(): ReturnType<
  typeof useMutation<
    Awaited<ReturnType<typeof resolveWarrantyAlert>>,
    Error,
    Parameters<typeof resolveWarrantyAlert>[0]
  >
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: resolveWarrantyAlert,
    onSuccess: async (res) => {
      if (!res.success) toast.error(res.error);
      else {
        await queryClient.invalidateQueries({ queryKey: warrantyKeys.all });
        await queryClient.invalidateQueries({ queryKey: projectKeys.all });
        toast.success("Alert resolved");
      }
    },
    onError: () => {
      toast.error("Could not resolve");
    },
  });
}

export function useReopenWarrantyAlert(): ReturnType<
  typeof useMutation<
    Awaited<ReturnType<typeof reopenWarrantyAlert>>,
    Error,
    Parameters<typeof reopenWarrantyAlert>[0]
  >
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: reopenWarrantyAlert,
    onSuccess: async (res) => {
      if (!res.success) toast.error(res.error);
      else {
        await queryClient.invalidateQueries({ queryKey: warrantyKeys.all });
        toast.success("Alert reopened");
      }
    },
    onError: () => {
      toast.error("Could not reopen");
    },
  });
}
