import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createManualJournalEntry,
  getLedgerAccountOptions,
  getProjectOptions,
} from "@/actions/manual-journal-actions";
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
    staleTime: 5 * 60 * 1000,
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
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateManualJournalEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ManualJournalInput) => createManualJournalEntry(data),
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Journal entry created successfully");
        queryClient.invalidateQueries({ queryKey: ledgerKeys.all });
        queryClient.invalidateQueries({ queryKey: financeDashboardKeys.all });
        queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
      } else {
        toast.error(result.error);
      }
    },
    onError: (error) => {
      toast.error(`Failed to create journal entry: ${error.message}`);
    },
  });
}
