import { z } from "zod";
import { JOURNAL_SOURCE_TYPES, LEDGER_ACCOUNT_CODES } from "@/lib/domain/enums";

const journalLineSchema = z.object({
  accountCode: z.enum(LEDGER_ACCOUNT_CODES),
  debit: z.number().min(0, "Debit must be non-negative"),
  credit: z.number().min(0, "Credit must be non-negative"),
  memo: z.string().optional(),
});

export const manualJournalSchema = z
  .object({
    entryDate: z.string().min(1, "Entry date is required"),
    memo: z.string().min(1, "Memo is required").max(500, "Memo must be under 500 characters"),
    sourceType: z.enum(JOURNAL_SOURCE_TYPES).default("manual_adjustment"),
    projectId: z.string().uuid().optional().nullable(),
    lines: z
      .array(journalLineSchema)
      .min(2, "Journal entry requires at least two lines")
      .max(20, "Maximum 20 lines per entry"),
  })
  .refine(
    (data) => {
      let totalDebit = 0;
      let totalCredit = 0;
      let hasInvalidLine = false;

      for (const line of data.lines) {
        const hasDebit = line.debit > 0;
        const hasCredit = line.credit > 0;

        if ((hasDebit && hasCredit) || (!hasDebit && !hasCredit)) {
          hasInvalidLine = true;
        }

        totalDebit += Math.round(line.debit);
        totalCredit += Math.round(line.credit);
      }

      if (hasInvalidLine) {
        return {
          success: false,
          error: {
            message: "Each line must be debit-only or credit-only (not both, not neither)",
            path: ["lines"],
          },
        };
      }

      if (totalDebit !== totalCredit) {
        return {
          success: false,
          error: {
            message: `Entry is unbalanced: Debit ${totalDebit.toLocaleString()} ≠ Credit ${totalCredit.toLocaleString()}`,
            path: ["lines"],
          },
        };
      }

      return { success: true };
    },
    { message: "Journal entry validation failed" },
  );

export type ManualJournalInput = z.input<typeof manualJournalSchema>;
export type ManualJournalOutput = z.output<typeof manualJournalSchema>;
