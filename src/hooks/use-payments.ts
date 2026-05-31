import { useQuery } from "@tanstack/react-query";
import {
  getPaymentFinanceSummary,
  getPaymentMethods,
  getProjectPayments,
  recordPayment,
} from "@/actions/payment-actions";
import { createMutationHook } from "@/hooks/mutation-factory";
import { STALE_TIME } from "@/lib/query-config";
import { financeDashboardKeys, financeKeys, projectKeys } from "@/lib/query-keys";
import type { ActionData } from "@/lib/utils/action-response";

export function useProjectPayments(
  projectId: string,
): ReturnType<typeof useQuery<ActionData<Awaited<ReturnType<typeof getProjectPayments>>>>> {
  return useQuery({
    queryKey: [...projectKeys.detail(projectId), "payments"],
    queryFn: async () => {
      const res = await getProjectPayments(projectId);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    enabled: !!projectId,
    staleTime: STALE_TIME.SHORT,
  });
}

export function usePaymentMethods(): ReturnType<
  typeof useQuery<ActionData<Awaited<ReturnType<typeof getPaymentMethods>>>>
> {
  return useQuery({
    queryKey: [...financeKeys.all, "methods"],
    queryFn: async () => {
      const res = await getPaymentMethods();
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    staleTime: STALE_TIME.LONG,
  });
}

export const useRecordPayment = createMutationHook({
  mutationFn: (raw: unknown) => recordPayment(raw),
  invalidateKeys: [projectKeys.all, financeKeys.all, financeDashboardKeys.all],
  successMessage: "Payment recorded",
  errorMessage: "Failed to record payment",
});

export function useFinanceSummary(): ReturnType<
  typeof useQuery<ActionData<Awaited<ReturnType<typeof getPaymentFinanceSummary>>>>
> {
  return useQuery({
    queryKey: financeKeys.all,
    queryFn: async () => {
      const res = await getPaymentFinanceSummary();
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    staleTime: STALE_TIME.MEDIUM,
  });
}
