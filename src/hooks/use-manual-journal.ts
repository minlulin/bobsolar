import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createManualJournalEntry,
  getLedgerAccountOptions,
  getProjectOptions,
} from "@/actions/manual-journal-actions";

export function useLedgerAccountOptions() {
  return useQuery({
    queryKey: ["manual-journal", "accounts"],
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
    queryKey: ["manual-journal", "projects"],
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
    mutationFn: (data: unknown) => createManualJournalEntry(data),
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Journal entry created successfully");
        queryClient.invalidateQueries({ queryKey: ["ledger"] });
        queryClient.invalidateQueries({ queryKey: ["finance-dashboard"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      } else {
        toast.error(result.error);
      }
    },
    onError: (error) => {
      toast.error(`Failed to create journal entry: ${error.message}`);
    },
  });
}
