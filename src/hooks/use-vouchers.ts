import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { generateVoucher, getProjectVouchers } from "@/actions/voucher-actions";
import { projectKeys } from "@/lib/query-keys";

type ActionData<T> = T extends { data: infer D } ? D : never;

export function useProjectVouchers(
  projectId: string,
): ReturnType<typeof useQuery<ActionData<Awaited<ReturnType<typeof getProjectVouchers>>>>> {
  return useQuery({
    queryKey: [...projectKeys.detail(projectId), "vouchers"],
    queryFn: async () => {
      const res = await getProjectVouchers(projectId);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    enabled: !!projectId,
    staleTime: 30 * 1000,
  });
}

export function useGenerateVoucher(): ReturnType<
  typeof useMutation<
    Awaited<ReturnType<typeof generateVoucher>>,
    Error,
    Parameters<typeof generateVoucher>[0]
  >
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: generateVoucher,
    onSuccess: async (res, vars) => {
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      const input = vars as { projectId: string };
      await queryClient.invalidateQueries({
        queryKey: [...projectKeys.detail(input.projectId), "vouchers"],
      });
      await queryClient.invalidateQueries({ queryKey: projectKeys.all });
      toast.success(`Voucher ${res.data.voucherNumber} generated`);
    },
    onError: () => {
      toast.error("Failed to generate voucher");
    },
  });
}
