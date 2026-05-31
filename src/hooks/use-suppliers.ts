import { useQuery } from "@tanstack/react-query";
import {
  createSupplier,
  deleteSupplier,
  getSuppliers,
  updateSupplier,
} from "@/actions/supplier-actions";
import { createMutationHook } from "@/hooks/mutation-factory";
import { supplierKeys } from "@/lib/query-keys";
import type { CreateSupplier, UpdateSupplier } from "@/lib/validators/supplier";

export function useSuppliers() {
  return useQuery({
    queryKey: supplierKeys.all,
    queryFn: async () => {
      const res = await getSuppliers();
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
  });
}

export const useCreateSupplier = createMutationHook({
  mutationFn: (data: CreateSupplier) => createSupplier(data),
  invalidateKeys: [supplierKeys.all],
  successMessage: "Supplier created successfully",
  errorMessage: "Failed to create supplier",
});

export const useUpdateSupplier = createMutationHook({
  mutationFn: (args: { id: string; data: UpdateSupplier }) => updateSupplier(args.id, args.data),
  invalidateKeys: [supplierKeys.all],
  successMessage: "Supplier updated successfully",
  errorMessage: "Failed to update supplier",
});

export const useDeleteSupplier = createMutationHook({
  mutationFn: (id: string) => deleteSupplier(id),
  invalidateKeys: [supplierKeys.all],
  successMessage: "Supplier deleted successfully",
  errorMessage: "Failed to delete supplier",
});
