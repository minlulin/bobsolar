import { createCashTransfer } from "@/actions/cash-transfer-actions";
import { createMutationHook } from "@/hooks/mutation-factory";
import { financeKeys } from "@/lib/query-keys";
import type { CashTransferInput } from "@/lib/validators/cash-transfer";

export const useCreateCashTransfer = createMutationHook({
  mutationFn: (data: CashTransferInput) => createCashTransfer(data),
  invalidateKeys: [financeKeys.all],
  successMessage: "Cash transfer recorded successfully",
  errorMessage: "Failed to record cash transfer",
});
