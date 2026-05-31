import { useQuery } from "@tanstack/react-query";
import {
  getWarrantyAlerts,
  getWarrantySummary,
  reopenWarrantyAlert,
  resolveWarrantyAlert,
} from "@/actions/warranty-actions";
import { createMutationHook } from "@/hooks/mutation-factory";
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

export const useResolveWarrantyAlert = createMutationHook({
  mutationFn: (id: string) => resolveWarrantyAlert(id),
  invalidateKeys: [warrantyKeys.all, projectKeys.all],
  successMessage: "Alert resolved",
  errorMessage: "Could not resolve",
});

export const useReopenWarrantyAlert = createMutationHook({
  mutationFn: (id: string) => reopenWarrantyAlert(id),
  invalidateKeys: [warrantyKeys.all],
  successMessage: "Alert reopened",
  errorMessage: "Could not reopen",
});
