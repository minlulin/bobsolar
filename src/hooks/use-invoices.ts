import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { createInvoice } from "@/actions/invoice-actions";

export function useCreateInvoice(): ReturnType<
  typeof useMutation<
    Awaited<ReturnType<typeof createInvoice>>,
    Error,
    Parameters<typeof createInvoice>[0]
  >
> {
  return useMutation({
    mutationFn: createInvoice,
    onSuccess: (res) => {
      if (res.success) {
        toast.success("Invoice created");
      } else {
        toast.error(res.error);
      }
    },
    onError: () => {
      toast.error("Failed to create invoice");
    },
  });
}
