import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getQuotations,
  getQuotation,
  createQuotation,
  updateQuotation,
  updateQuotationStatus,
  deleteQuotation,
  duplicateQuotation,
} from '@/actions/quotation-actions';
import {
  type QuotationFilter,
  type UpdateQuotation,
} from '@/lib/validators/quotation';
import { toast } from 'sonner';

export function useQuotations(filters: QuotationFilter = {}) {
  return useQuery({
    queryKey: ['quotations', filters],
    queryFn: () => getQuotations(filters),
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useQuotation(id: string) {
  return useQuery({
    queryKey: ['quotations', id],
    queryFn: () => getQuotation(id),
    enabled: !!id,
  });
}

export function useCreateQuotation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createQuotation,
    onSuccess: (response) => {
      if (response.success) {
        queryClient.invalidateQueries({ queryKey: ['quotations'] });
        toast.success('Quotation created successfully');
      } else {
        toast.error(response.error);
      }
    },
    onError: () => {
      toast.error('Failed to create quotation');
    },
  });
}

export function useUpdateQuotationStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
    }) => updateQuotationStatus(id, status),
    onSuccess: (response) => {
      if (response.success) {
        queryClient.invalidateQueries({ queryKey: ['quotations'] });
        toast.success('Status updated successfully');
      } else {
        toast.error(response.error);
      }
    },
    onError: () => {
      toast.error('Failed to update status');
    },
  });
}

export function useDeleteQuotation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteQuotation,
    onSuccess: (response) => {
      if (response.success) {
        queryClient.invalidateQueries({ queryKey: ['quotations'] });
        toast.success('Quotation deleted successfully');
      } else {
        toast.error(response.error);
      }
    },
    onError: () => {
      toast.error('Failed to delete quotation');
    },
  });
}

export function useUpdateQuotation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateQuotation }) =>
      updateQuotation(id, data),
    onSuccess: (response) => {
      if (response.success) {
        queryClient.invalidateQueries({ queryKey: ['quotations'] });
        toast.success('Quotation updated successfully');
      } else {
        toast.error(response.error);
      }
    },
    onError: () => {
      toast.error('Failed to update quotation');
    },
  });
}

export function useDuplicateQuotation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: duplicateQuotation,
    onSuccess: (response) => {
      if (response.success) {
        queryClient.invalidateQueries({ queryKey: ['quotations'] });
        toast.success('Quotation duplicated successfully');
      } else {
        toast.error(response.error);
      }
    },
    onError: () => {
      toast.error('Failed to duplicate quotation');
    },
  });
}
