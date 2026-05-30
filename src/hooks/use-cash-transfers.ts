import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createCashTransfer } from "@/actions/cash-transfer-actions";
import type { CashTransferInput } from "@/lib/validators/cash-transfer";

export function useCreateCashTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CashTransferInput) => {
      const res = await createCashTransfer(data);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Cash transfer recorded successfully");
      void queryClient.invalidateQueries({ queryKey: ["finance"] });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to record cash transfer");
    },
  });
}
