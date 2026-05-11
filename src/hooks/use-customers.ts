import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query';
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

export function useCustomers(filters: CustomerFilter = {}): UseQueryResult<Awaited<ReturnType<typeof getCustomers>>> {
  return useQuery({
    queryKey: ['customers', filters],
    queryFn: () => getCustomers(filters),
    staleTime: 30 * 1000,
  });
}

export function useCustomer(id: string): UseQueryResult<Awaited<ReturnType<typeof getCustomer>>> {
  return useQuery({
    queryKey: ['customers', id],
    queryFn: () => getCustomer(id),
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

export function useCreateCustomer(): UseMutationResult<
  Awaited<ReturnType<typeof createCustomer>>
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCustomer,
    onSuccess: (response) => {
      if (response.success) {
        void queryClient.invalidateQueries({ queryKey: ['customers'] });
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

export function useUpdateCustomer(): UseMutationResult<
  Awaited<ReturnType<typeof updateCustomer>>,
  Error,
  { id: string; data: Partial<CreateCustomer> }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateCustomer> }) =>
      updateCustomer(id, data),
    onSuccess: (response) => {
      if (response.success) {
        void queryClient.invalidateQueries({ queryKey: ['customers'] });
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

export function useDeleteCustomer(): UseMutationResult<
  Awaited<ReturnType<typeof deleteCustomer>>,
  Error,
  Parameters<typeof deleteCustomer>[0]
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteCustomer,
    onSuccess: (response) => {
      if (response.success) {
        void queryClient.invalidateQueries({ queryKey: ['customers'] });
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

export function useSearchCustomers(query: string): UseQueryResult<Awaited<ReturnType<typeof searchCustomers>>> {
  return useQuery({
    queryKey: ['customers', 'search', query],
    queryFn: () => searchCustomers(query),
    enabled: query.length >= 2,
    staleTime: 30 * 1000,
  });
}
