import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createPurchaseOrder,
  getPurchaseOrderById,
  getPurchaseOrders,
  payPurchaseOrder,
  receivePurchaseOrder,
} from "@/actions/purchase-actions";
import { inventoryKeys, purchaseKeys } from "@/lib/query-keys";
import type { ActionData } from "@/lib/utils/action-response";
import type { CreatePurchaseOrder, PayPurchaseOrder } from "@/lib/validators/purchase";
export type PurchaseOrderListRow = ActionData<
  Awaited<ReturnType<typeof getPurchaseOrders>>
>[number];
export type PurchaseOrderDetail = ActionData<Awaited<ReturnType<typeof getPurchaseOrderById>>>;

export function usePurchases() {
  return useQuery({
    queryKey: purchaseKeys.list(),
    queryFn: async () => {
      const res = await getPurchaseOrders();
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
  });
}

export function usePurchaseOrder(id: string) {
  return useQuery({
    queryKey: purchaseKeys.detail(id),
    queryFn: async () => {
      const res = await getPurchaseOrderById(id);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useCreatePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreatePurchaseOrder) => {
      return createPurchaseOrder(data);
    },
    onSuccess: (response) => {
      if (response.success) {
        toast.success("Purchase order created successfully");
        queryClient.invalidateQueries({ queryKey: purchaseKeys.all });
      } else {
        toast.error(response.error);
      }
    },
  });
}

export function useReceivePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await receivePurchaseOrder(id);
      if (!res.success) throw new Error(res.error);
      return true;
    },
    onSuccess: (_, id) => {
      toast.success("Purchase order received and inventory updated");
      queryClient.invalidateQueries({ queryKey: purchaseKeys.all });
      queryClient.invalidateQueries({ queryKey: purchaseKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });
}

export function usePayPurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: PayPurchaseOrder) => {
      const res = await payPurchaseOrder(data);
      if (!res.success) throw new Error(res.error);
      return true;
    },
    onSuccess: (_, variables) => {
      toast.success("Payment recorded successfully");
      queryClient.invalidateQueries({ queryKey: purchaseKeys.all });
      queryClient.invalidateQueries({
        queryKey: purchaseKeys.detail(variables.purchaseOrderId),
      });
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });
}
