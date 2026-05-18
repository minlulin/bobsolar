import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import {
  createCustomer,
  deleteCustomer,
  getCustomer,
  getCustomers,
  searchCustomers,
  updateCustomer,
} from "@/actions/customer-actions";
import { createMutationHook } from "@/hooks/mutation-factory";
import type { Customer, Project, Quotation } from "@/lib/db/schema";
import type { CreateCustomer, CustomerFilter } from "@/lib/validators/customer";

type PaginatedCustomers = { items: Customer[]; total: number };

export type CustomerWithHistory = Customer & {
  quotations: (Quotation & {
    createdBy: { name: string };
  })[];
  projects: (Project & {
    quotation: { quoteNumber: string } | null;
    costs: { amount: string }[];
  })[];
};

export function useCustomers(filters: CustomerFilter = {}): UseQueryResult<PaginatedCustomers> {
  return useQuery<PaginatedCustomers>({
    queryKey: ["customers", filters],
    queryFn: async () => {
      const res = await getCustomers(filters);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    staleTime: 30 * 1000,
  });
}

export function useCustomer(id: string): UseQueryResult<CustomerWithHistory> {
  return useQuery<CustomerWithHistory>({
    queryKey: ["customers", id],
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
    queryKey: ["customers", "search", query],
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
  invalidateKeys: [["customers"]],
  successMessage: "Customer added successfully",
  errorMessage: "Failed to add customer",
});

export const useUpdateCustomer = createMutationHook({
  mutationFn: (args: { id: string; data: Partial<CreateCustomer> }) =>
    updateCustomer(args.id, args.data),
  invalidateKeys: [["customers"]],
  successMessage: "Customer updated successfully",
  errorMessage: "Failed to update customer",
});

export const useDeleteCustomer = createMutationHook({
  mutationFn: (id: string) => deleteCustomer(id),
  invalidateKeys: [["customers"]],
  successMessage: "Customer deleted successfully",
  errorMessage: "Failed to delete customer",
});
