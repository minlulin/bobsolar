import { useQuery } from "@tanstack/react-query";
import {
  createManualJournalEntry,
  getLedgerAccountOptions,
  getProjectOptions,
} from "@/actions/manual-journal-actions";
import { createMutationHook } from "@/hooks/mutation-factory";
import { STALE_TIME } from "@/lib/query-config";
import {
  dashboardKeys,
  financeDashboardKeys,
  ledgerKeys,
  manualJournalKeys,
} from "@/lib/query-keys";
import type { ManualJournalInput } from "@/lib/validators/manual-journal";

export function useLedgerAccountOptions() {
  return useQuery({
    queryKey: manualJournalKeys.accounts(),
    queryFn: async () => {
      const response = await getLedgerAccountOptions();
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    staleTime: STALE_TIME.LONG,
  });
}

export function useProjectOptions() {
  return useQuery({
    queryKey: manualJournalKeys.projects(),
    queryFn: async () => {
      const response = await getProjectOptions();
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    staleTime: STALE_TIME.LONG,
  });
}

export const useCreateManualJournalEntry = createMutationHook({
  mutationFn: (data: ManualJournalInput) => createManualJournalEntry(data),
  invalidateKeys: [ledgerKeys.all, financeDashboardKeys.all, dashboardKeys.all],
  successMessage: "Journal entry created successfully",
  errorMessage: "Failed to create journal entry",
});
