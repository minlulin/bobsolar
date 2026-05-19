import { useQuery } from "@tanstack/react-query";
import type { LedgerFilter } from "@/actions/ledger-actions";
import { getAccountBalances, getLedgerEntries, getLedgerProjects } from "@/actions/ledger-actions";
import { ledgerKeys } from "@/lib/query-keys";

export function useLedgerEntries(filters: LedgerFilter = {}) {
  return useQuery({
    queryKey: ledgerKeys.entries(filters),
    queryFn: async () => {
      const response = await getLedgerEntries(filters);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    staleTime: 30 * 1000,
  });
}

export function useAccountBalances(filters: LedgerFilter = {}) {
  return useQuery({
    queryKey: ledgerKeys.balances(filters),
    queryFn: async () => {
      const response = await getAccountBalances(filters);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    staleTime: 60 * 1000,
  });
}

export function useLedgerProjects() {
  return useQuery({
    queryKey: ledgerKeys.projects(),
    queryFn: async () => {
      const response = await getLedgerProjects();
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}
