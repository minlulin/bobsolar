import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import type { CustomerWithHistory } from "@/actions/customer-actions";
import {
  createCustomer,
  deleteCustomer,
  getCustomer,
  getCustomers,
  searchCustomers,
  updateCustomer,
} from "@/actions/customer-actions";
import { createMutationHook } from "@/hooks/mutation-factory";
import type { Customer } from "@/lib/db/schema";
import { customerKeys } from "@/lib/query-keys";
import type { CreateCustomer, CustomerFilter } from "@/lib/validators/customer";

type PaginatedCustomers = { items: Customer[]; total: number };

export function useCustomers(
  filters: CustomerFilter = {},
  initialData?: PaginatedCustomers,
): UseQueryResult<PaginatedCustomers> {
  return useQuery<PaginatedCustomers>({
    queryKey: customerKeys.list(filters),
    queryFn: async () => {
      const res = await getCustomers(filters);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    ...(initialData !== undefined && { initialData }),
    staleTime: 30 * 1000,
  });
}

export function useCustomer(id: string): UseQueryResult<CustomerWithHistory> {
  return useQuery<CustomerWithHistory>({
    queryKey: customerKeys.detail(id),
    queryFn: async () => {
      const res = await getCustomer(id);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

export function useSearchCustomers(query: string): UseQueryResult<Customer[]> {
  return useQuery<Customer[]>({
    queryKey: customerKeys.search(query),
    queryFn: async () => {
      const res = await searchCustomers(query);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    enabled: query.length >= 2,
    staleTime: 30 * 1000,
  });
}

export const useCreateCustomer = createMutationHook({
  mutationFn: (data: CreateCustomer) => createCustomer(data),
  invalidateKeys: [customerKeys.all],
  successMessage: "Customer added successfully",
  errorMessage: "Failed to add customer",
});

export const useUpdateCustomer = createMutationHook({
  mutationFn: (args: { id: string; data: Partial<CreateCustomer> }) =>
    updateCustomer(args.id, args.data),
  invalidateKeys: [customerKeys.all],
  successMessage: "Customer updated successfully",
  errorMessage: "Failed to update customer",
});

export const useDeleteCustomer = createMutationHook({
  mutationFn: (id: string) => deleteCustomer(id),
  invalidateKeys: [customerKeys.all],
  successMessage: "Customer deleted successfully",
  errorMessage: "Failed to delete customer",
});
