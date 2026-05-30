import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  archiveQuotation,
  createQuotation,
  deleteQuotation,
  duplicateQuotation,
  getQuotation,
  getQuotations,
  restoreQuotation,
  updateQuotation,
  updateQuotationStatus,
} from "@/actions/quotation-actions";
import type { QuotationStatus } from "@/lib/db/schema";
import { quotationKeys } from "@/lib/query-keys";
import type { QuotationFilterInput, UpdateQuotation } from "@/lib/validators/quotation";

type ActionData<T> = T extends { data: infer D } ? D : never;

export function useQuotations(
  filters: QuotationFilterInput = {},
  initialData?: ActionData<Awaited<ReturnType<typeof getQuotations>>>,
): ReturnType<typeof useQuery<ActionData<Awaited<ReturnType<typeof getQuotations>>>>> {
  return useQuery({
    queryKey: quotationKeys.list(filters),
    queryFn: async () => {
      const response = await getQuotations(filters);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    ...(initialData ? { initialData } : {}),
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useQuotation(
  id: string,
): ReturnType<typeof useQuery<ActionData<Awaited<ReturnType<typeof getQuotation>>>>> {
  return useQuery({
    queryKey: quotationKeys.detail(id),
    queryFn: async () => {
      const response = await getQuotation(id);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

export function useCreateQuotation(): ReturnType<
  typeof useMutation<
    Awaited<ReturnType<typeof createQuotation>>,
    Error,
    Parameters<typeof createQuotation>[0]
  >
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createQuotation,
    onSuccess: async (response) => {
      if (response.success) {
        await queryClient.invalidateQueries({ queryKey: quotationKeys.all });
        await queryClient.invalidateQueries({
          queryKey: quotationKeys.detail(response.data.id),
        });
        toast.success("Quotation created successfully");
      } else {
        toast.error(response.error);
      }
    },
    onError: (error) => {
      toast.error(error.message ?? "Failed to create quotation. Please try again.");
    },
  });
}

export function useUpdateQuotationStatus(): ReturnType<
  typeof useMutation<
    Awaited<ReturnType<typeof updateQuotationStatus>>,
    Error,
    { id: string; status: QuotationStatus }
  >
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: QuotationStatus }) =>
      updateQuotationStatus(id, status),
    onSuccess: async (response, variables) => {
      if (response.success) {
        await queryClient.invalidateQueries({ queryKey: quotationKeys.all });
        await queryClient.invalidateQueries({
          queryKey: quotationKeys.detail(variables.id),
        });
        toast.success("Status updated successfully");
      } else {
        toast.error(response.error);
      }
    },
    onError: (error) => {
      toast.error(error.message ?? "Failed to update status. Please try again.");
    },
  });
}

export function useDeleteQuotation(): ReturnType<
  typeof useMutation<Awaited<ReturnType<typeof deleteQuotation>>, Error, string>
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteQuotation,
    onSuccess: async (response, deletedId) => {
      if (response.success) {
        await queryClient.invalidateQueries({ queryKey: quotationKeys.all });
        await queryClient.invalidateQueries({
          queryKey: quotationKeys.detail(deletedId),
        });
        toast.success("Quotation deleted successfully");
      } else {
        toast.error(response.error);
      }
    },
    onError: (error) => {
      toast.error(error.message ?? "Failed to delete quotation. Please try again.");
    },
  });
}

export function useUpdateQuotation(): ReturnType<
  typeof useMutation<
    Awaited<ReturnType<typeof updateQuotation>>,
    Error,
    { id: string; data: UpdateQuotation }
  >
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateQuotation }) => updateQuotation(id, data),
    onSuccess: async (response, variables) => {
      if (response.success) {
        await queryClient.invalidateQueries({ queryKey: quotationKeys.all });
        await queryClient.invalidateQueries({
          queryKey: quotationKeys.detail(variables.id),
        });
        toast.success("Quotation updated successfully");
      } else {
        toast.error(response.error);
      }
    },
    onError: (error) => {
      toast.error(error.message ?? "Failed to update quotation. Please try again.");
    },
  });
}

export function useDuplicateQuotation(): ReturnType<
  typeof useMutation<Awaited<ReturnType<typeof duplicateQuotation>>, Error, string>
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: duplicateQuotation,
    onSuccess: async (response, originalId) => {
      if (response.success) {
        await queryClient.invalidateQueries({ queryKey: quotationKeys.all });
        await queryClient.invalidateQueries({
          queryKey: quotationKeys.detail(originalId),
        });
        await queryClient.invalidateQueries({
          queryKey: quotationKeys.detail(response.data.id),
        });
        toast.success("Quotation duplicated successfully");
      } else {
        toast.error(response.error);
      }
    },
    onError: (error) => {
      toast.error(error.message ?? "Failed to duplicate quotation. Please try again.");
    },
  });
}

export function useArchiveQuotation(): ReturnType<
  typeof useMutation<Awaited<ReturnType<typeof archiveQuotation>>, Error, string>
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: archiveQuotation,
    onSuccess: async (response, id) => {
      if (response.success) {
        await queryClient.invalidateQueries({ queryKey: quotationKeys.all });
        await queryClient.invalidateQueries({
          queryKey: quotationKeys.detail(id),
        });
        toast.success("Quotation archived");
      } else {
        toast.error(response.error);
      }
    },
    onError: (error) => {
      toast.error(error.message ?? "Failed to archive quotation. Please try again.");
    },
  });
}

export function useRestoreQuotation(): ReturnType<
  typeof useMutation<Awaited<ReturnType<typeof restoreQuotation>>, Error, string>
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: restoreQuotation,
    onSuccess: async (response, id) => {
      if (response.success) {
        await queryClient.invalidateQueries({ queryKey: quotationKeys.all });
        await queryClient.invalidateQueries({
          queryKey: quotationKeys.detail(id),
        });
        toast.success("Quotation restored");
      } else {
        toast.error(response.error);
      }
    },
    onError: (error) => {
      toast.error(error.message ?? "Failed to restore quotation. Please try again.");
    },
  });
}
