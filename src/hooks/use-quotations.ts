import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getQuotations,
  getQuotation,
  createQuotation,
  updateQuotationStatus,
  deleteQuotation,
} from '@/actions/quotation-actions';
import { type QuotationFilter } from '@/lib/validators/quotation';
import { toast } from 'sonner';

export function useQuotations(filters: QuotationFilter = {}) {
  return useQuery({
    queryKey: ['quotations', filters],
    queryFn: () => getQuotations(filters),
    staleTime: 2 * 60 * 1000, // 2 minutes
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
