import { useQuery } from "@tanstack/react-query";
import { getAccountBalances, getLedgerEntries, getLedgerProjects } from "@/actions/ledger-actions";
import { STALE_TIME } from "@/lib/query-config";
import { ledgerKeys } from "@/lib/query-keys";
import type { LedgerFilter } from "@/lib/validators/ledger";

export function useLedgerEntries(filters: LedgerFilter = {}) {
  return useQuery({
    queryKey: ledgerKeys.entries(filters),
    queryFn: async () => {
      const response = await getLedgerEntries(filters);
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    staleTime: STALE_TIME.SHORT,
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
    staleTime: STALE_TIME.MEDIUM,
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
    staleTime: STALE_TIME.LONG,
  });
}
