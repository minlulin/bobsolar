import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getPaymentFinanceSummary,
  getPaymentMethods,
  getProjectPayments,
  recordPayment,
} from "@/actions/payment-actions";
import { financeDashboardKeys, financeKeys, projectKeys } from "@/lib/query-keys";

type ActionData<T> = T extends { data: infer D } ? D : never;

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
    staleTime: 30 * 1000,
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
    staleTime: 5 * 60 * 1000,
  });
}

export function useRecordPayment(): ReturnType<
  typeof useMutation<
    Awaited<ReturnType<typeof recordPayment>>,
    Error,
    Parameters<typeof recordPayment>[0]
  >
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: recordPayment,
    onSuccess: async (res, vars) => {
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      const input = vars as { projectId: string };
      await queryClient.invalidateQueries({
        queryKey: [...projectKeys.detail(input.projectId), "payments"],
      });
      await queryClient.invalidateQueries({ queryKey: projectKeys.all });
      await queryClient.invalidateQueries({ queryKey: financeKeys.all });
      await queryClient.invalidateQueries({ queryKey: financeDashboardKeys.all });
      toast.success("Payment recorded");
    },
    onError: () => {
      toast.error("Failed to record payment");
    },
  });
}

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
    staleTime: 60 * 1000,
  });
}
