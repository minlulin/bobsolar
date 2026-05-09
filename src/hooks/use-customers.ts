import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  searchCustomers,
} from '@/actions/customer-actions';
import {
  type CustomerFilter,
  type CreateCustomer,
} from '@/lib/validators/customer';
import { toast } from 'sonner';

export function useCustomers(filters: CustomerFilter = {}) {
  return useQuery({
    queryKey: ['customers', filters],
    queryFn: () => getCustomers(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: ['customers', id],
    queryFn: () => getCustomer(id),
    enabled: !!id,
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCustomer,
    onSuccess: (response) => {
      if (response.success) {
        queryClient.invalidateQueries({ queryKey: ['customers'] });
        toast.success('Customer added successfully');
      } else {
        toast.error(response.error);
      }
    },
    onError: () => {
      toast.error('Failed to add customer');
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateCustomer> }) =>
      updateCustomer(id, data),
    onSuccess: (response) => {
      if (response.success) {
        queryClient.invalidateQueries({ queryKey: ['customers'] });
        toast.success('Customer updated successfully');
      } else {
        toast.error(response.error);
      }
    },
    onError: () => {
      toast.error('Failed to update customer');
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteCustomer,
    onSuccess: (response) => {
      if (response.success) {
        queryClient.invalidateQueries({ queryKey: ['customers'] });
        toast.success('Customer deleted successfully');
      } else {
        toast.error(response.error);
      }
    },
    onError: () => {
      toast.error('Failed to delete customer');
    },
  });
}

export function useSearchCustomers(query: string) {
  return useQuery({
    queryKey: ['customers', 'search', query],
    queryFn: () => searchCustomers(query),
    enabled: query.length >= 2,
  });
}
