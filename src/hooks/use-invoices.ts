import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { createInvoice, getInvoices } from "@/actions/invoice-actions";
import { STALE_TIME } from "@/lib/query-config";
import { invoiceKeys } from "@/lib/query-keys";
import type { ActionData } from "@/lib/utils/action-response";
import type { InvoiceListFilterInput } from "@/lib/validators/invoice";

export function useInvoices(
  filters: InvoiceListFilterInput = {},
  initialData?: ActionData<Awaited<ReturnType<typeof getInvoices>>>,
): ReturnType<typeof useQuery<ActionData<Awaited<ReturnType<typeof getInvoices>>>>> {
  return useQuery({
    queryKey: invoiceKeys.list(filters),
    queryFn: async () => {
      const response = await getInvoices(filters);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    ...(initialData !== undefined ? { initialData } : {}),
    staleTime: STALE_TIME.SHORT,
  });
}

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
