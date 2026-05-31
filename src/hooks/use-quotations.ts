import { useQuery } from "@tanstack/react-query";
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
import { createMutationHook } from "@/hooks/mutation-factory";
import { STALE_TIME } from "@/lib/query-config";
import { quotationKeys } from "@/lib/query-keys";
import type { ActionData } from "@/lib/utils/action-response";
import type { QuotationFilterInput, UpdateQuotation } from "@/lib/validators/quotation";

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
    staleTime: STALE_TIME.SHORT,
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
    staleTime: STALE_TIME.SHORT,
  });
}

export const useCreateQuotation = createMutationHook({
  mutationFn: (raw: unknown) => createQuotation(raw),
  invalidateKeys: [quotationKeys.all],
  successMessage: "Quotation created successfully",
  errorMessage: "Failed to create quotation. Please try again.",
});

export const useUpdateQuotationStatus = createMutationHook({
  mutationFn: ({ id, status }: { id: string; status: string }) =>
    updateQuotationStatus(id, status as Parameters<typeof updateQuotationStatus>[1]),
  invalidateKeys: [quotationKeys.all],
  successMessage: "Status updated successfully",
  errorMessage: "Failed to update status. Please try again.",
});

export const useDeleteQuotation = createMutationHook({
  mutationFn: (id: string) => deleteQuotation(id),
  invalidateKeys: [quotationKeys.all],
  successMessage: "Quotation deleted successfully",
  errorMessage: "Failed to delete quotation. Please try again.",
});

export const useUpdateQuotation = createMutationHook({
  mutationFn: ({ id, data }: { id: string; data: UpdateQuotation }) => updateQuotation(id, data),
  invalidateKeys: [quotationKeys.all],
  successMessage: "Quotation updated successfully",
  errorMessage: "Failed to update quotation. Please try again.",
});

export const useDuplicateQuotation = createMutationHook({
  mutationFn: (id: string) => duplicateQuotation(id),
  invalidateKeys: [quotationKeys.all],
  successMessage: "Quotation duplicated successfully",
  errorMessage: "Failed to duplicate quotation. Please try again.",
});

export const useArchiveQuotation = createMutationHook({
  mutationFn: (id: string) => archiveQuotation(id),
  invalidateKeys: [quotationKeys.all],
  successMessage: "Quotation archived",
  errorMessage: "Failed to archive quotation",
});

export const useRestoreQuotation = createMutationHook({
  mutationFn: (id: string) => restoreQuotation(id),
  invalidateKeys: [quotationKeys.all],
  successMessage: "Quotation restored",
  errorMessage: "Failed to restore quotation",
});
