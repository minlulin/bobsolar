"use server";

import { requireOwner } from "@/lib/auth/validate";
import { db } from "@/lib/db";
import { invalidateFinanceCacheForWrite } from "@/lib/finance/cache-invalidation";
import { createBalancedJournalEntry } from "@/lib/finance/ledger";
import { type ActionResponse, successResponse } from "@/lib/utils/action-response";
import { handleActionError } from "@/lib/utils/error";
import { cashTransferSchema } from "@/lib/validators/cash-transfer";

export async function createCashTransfer(
  raw: unknown,
): Promise<ActionResponse<{ entryId: string }>> {
  try {
    const auth = await requireOwner();
    const data = cashTransferSchema.parse(raw);

    const result = await db.transaction(async (tx) => {
      const entryId = crypto.randomUUID();

      const entry = await createBalancedJournalEntry({
        tx,
        entryDate: data.date,
        memo: `Cash Transfer: ${data.notes || "No notes"}`,
        sourceType: "cash_transfer",
        sourceId: entryId,
        createdBy: auth.userId,
        lines: [
          {
            accountCode: data.toAccount,
            debit: Math.round(data.amount),
            credit: 0,
            memo: data.reference ? `Ref: ${data.reference}` : null,
          },
          {
            accountCode: data.fromAccount,
            debit: 0,
            credit: Math.round(data.amount),
            memo: data.reference ? `Ref: ${data.reference}` : null,
          },
        ],
      });

      return entry;
    });

    await invalidateFinanceCacheForWrite();

    return successResponse(result);
  } catch (error) {
    return handleActionError(error, "createCashTransfer", "Failed to process cash transfer");
  }
}
