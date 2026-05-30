import { z } from "zod";
import { LEDGER_ACCOUNT_CODES } from "@/lib/domain/finance";

const journalLineSchema = z.object({
  accountCode: z.enum(LEDGER_ACCOUNT_CODES),
  debit: z.number().int("Debit must be a whole number").min(0, "Debit must be non-negative"),
  credit: z.number().int("Credit must be a whole number").min(0, "Credit must be non-negative"),
  memo: z.string().optional(),
});

export const manualJournalSchema = z
  .object({
    entryDate: z.coerce.date(),
    memo: z.string().min(1, "Memo is required").max(500, "Memo must be under 500 characters"),
    sourceType: z
      .enum(["manual_adjustment", "opening_balance", "backfill"])
      .default("manual_adjustment"),
    projectId: z.uuid().optional().nullable(),
    lines: z
      .array(journalLineSchema)
      .min(2, "Journal entry requires at least two lines")
      .max(20, "Maximum 20 lines per entry"),
  })
  .superRefine((data, ctx) => {
    let totalDebit = 0;
    let totalCredit = 0;
    let hasInvalidLine = false;

    for (const line of data.lines) {
      const hasDebit = line.debit > 0;
      const hasCredit = line.credit > 0;

      if ((hasDebit && hasCredit) || (!hasDebit && !hasCredit)) {
        hasInvalidLine = true;
      }

      totalDebit += line.debit;
      totalCredit += line.credit;
    }

    if (hasInvalidLine) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Each line must be debit-only or credit-only (not both, not neither)",
        path: ["lines"],
      });
    }

    if (totalDebit !== totalCredit) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Entry is unbalanced: Debit ${totalDebit.toLocaleString()} ≠ Credit ${totalCredit.toLocaleString()}`,
        path: ["lines"],
      });
    }
  });

export type ManualJournalInput = z.input<typeof manualJournalSchema>;
export type ManualJournalOutput = z.output<typeof manualJournalSchema>;
