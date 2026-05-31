import { useQuery } from "@tanstack/react-query";
import {
  createPurchaseOrder,
  getPurchaseOrderById,
  getPurchaseOrders,
  payPurchaseOrder,
  receivePurchaseOrder,
} from "@/actions/purchase-actions";
import { createMutationHook } from "@/hooks/mutation-factory";
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

export const useCreatePurchaseOrder = createMutationHook({
  mutationFn: (data: CreatePurchaseOrder) => createPurchaseOrder(data),
  invalidateKeys: [purchaseKeys.all],
  successMessage: "Purchase order created successfully",
  errorMessage: "Failed to create purchase order",
});

export const useReceivePurchaseOrder = createMutationHook({
  mutationFn: (id: string) => receivePurchaseOrder(id),
  invalidateKeys: [purchaseKeys.all, inventoryKeys.all],
  successMessage: "Purchase order received and inventory updated",
  errorMessage: "Failed to receive purchase order",
});

export const usePayPurchaseOrder = createMutationHook({
  mutationFn: (data: PayPurchaseOrder) => payPurchaseOrder(data),
  invalidateKeys: [purchaseKeys.all],
  successMessage: "Payment recorded successfully",
  errorMessage: "Failed to record payment",
});
