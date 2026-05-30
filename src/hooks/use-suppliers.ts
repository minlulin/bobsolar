import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createSupplier,
  deleteSupplier,
  getSuppliers,
  updateSupplier,
} from "@/actions/supplier-actions";
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

export function useCreateSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateSupplier) => {
      const res = await createSupplier(data);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Supplier created successfully");
      queryClient.invalidateQueries({ queryKey: supplierKeys.all });
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateSupplier }) => {
      const res = await updateSupplier(id, data);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Supplier updated successfully");
      queryClient.invalidateQueries({ queryKey: supplierKeys.all });
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });
}

export function useDeleteSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await deleteSupplier(id);
      if (!res.success) throw new Error(res.error);
      return true;
    },
    onSuccess: () => {
      toast.success("Supplier deleted successfully");
      queryClient.invalidateQueries({ queryKey: supplierKeys.all });
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });
}
