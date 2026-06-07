import { eq } from "drizzle-orm";
import { generalExpenses } from "@/lib/db/schema";
import type { LedgerAccountCode, OperatingExpenseAccountCode } from "@/lib/domain/finance";
import { createBalancedJournalEntry, type DbTransaction } from "./ledger";

type RecordExpenseInput = {
  tx: DbTransaction;
  payeeName: string;
  amount: number;
  expenseDate?: Date;
  expenseAccountCode: OperatingExpenseAccountCode;
  paymentMethodId?: string | null;
  paymentAssetAccountCode?: LedgerAccountCode | undefined; // If paying immediately
  reference?: string | null;
  notes?: string | null;
  createdBy: string;
};

export async function recordGeneralExpense(
  input: RecordExpenseInput,
): Promise<{ expenseId: string; journalEntryId: string | null }> {
  const isPaid = !!input.paymentMethodId && !!input.paymentAssetAccountCode;
  const date = input.expenseDate ?? new Date();

  // Create the expense record
  const account = await input.tx.query.ledgerAccounts.findFirst({
    where: (accounts, { eq }) => eq(accounts.code, input.expenseAccountCode),
    columns: { id: true },
  });

  if (!account) {
    throw new Error(`Ledger account not found for code: ${input.expenseAccountCode}`);
  }

  const [expense] = await input.tx
    .insert(generalExpenses)
    .values({
      payeeName: input.payeeName,
      amount: String(input.amount),
      expenseDate: date,
      accountId: account.id,
      paymentMethodId: input.paymentMethodId ?? null,
      reference: input.reference ?? null,
      notes: input.notes ?? null,
      isPaid,
      createdBy: input.createdBy,
    })
    .returning({ id: generalExpenses.id });

  if (!expense) {
    throw new Error("Failed to create general expense record.");
  }

  let journalEntryId: string | null = null;

  // Double entry logic — always required for accounting correctness
  if (isPaid) {
    // Immediate Cash Payment (Scenario A)
    // Debit: Operating Expense (e.g. Utilities)
    // Credit: Cash / Operating Bank Account (Asset)
    if (!input.paymentAssetAccountCode) {
      throw new Error("paymentAssetAccountCode is required for paid expenses");
    }
    const journalResult = await createBalancedJournalEntry({
      tx: input.tx,
      entryDate: date,
      memo: `General Expense Paid: ${input.payeeName} - ${input.reference ?? ""}`,
      sourceType: "general_expense",
      sourceId: expense.id,
      createdBy: input.createdBy,
      lines: [
        {
          accountCode: input.expenseAccountCode,
          debit: input.amount,
          credit: 0,
          memo: input.notes ?? null,
        },
        {
          accountCode: input.paymentAssetAccountCode,
          debit: 0,
          credit: input.amount,
        },
      ],
    });
    journalEntryId = journalResult.entryId;
  } else {
    // Accrued Expense (Scenario B)
    // Debit: Operating Expense
    // Credit: Accounts Payable - General
    const journalResult = await createBalancedJournalEntry({
      tx: input.tx,
      entryDate: date,
      memo: `General Expense Accrued: ${input.payeeName} - ${input.reference ?? ""}`,
      sourceType: "general_expense",
      sourceId: expense.id,
      createdBy: input.createdBy,
      lines: [
        {
          accountCode: input.expenseAccountCode,
          debit: input.amount,
          credit: 0,
          memo: input.notes ?? null,
        },
        {
          accountCode: "accounts_payable_general",
          debit: 0,
          credit: input.amount,
        },
      ],
    });
    journalEntryId = journalResult.entryId;
  }

  return { expenseId: expense.id, journalEntryId };
}

type PayExpenseInput = {
  tx: DbTransaction;
  expenseId: string;
  paymentMethodId: string;
  paymentAssetAccountCode: LedgerAccountCode;
  paymentDate?: Date;
  reference?: string | null;
  createdBy: string;
};

export async function payGeneralExpense(
  input: PayExpenseInput,
): Promise<{ journalEntryId: string }> {
  const expense = await input.tx.query.generalExpenses.findFirst({
    where: eq(generalExpenses.id, input.expenseId),
  });

  if (!expense) {
    throw new Error("Expense not found.");
  }

  if (expense.isPaid) {
    throw new Error("Expense is already paid.");
  }

  const date = input.paymentDate ?? new Date();

  // Mark as paid
  await input.tx
    .update(generalExpenses)
    .set({
      isPaid: true,
      paymentMethodId: input.paymentMethodId,
      reference: input.reference ?? expense.reference,
    })
    .where(eq(generalExpenses.id, input.expenseId));

  // Double entry logic for paying accrued expense
  // Debit: Accounts Payable - General
  // Credit: Cash / Operating Bank Account
  const journalResult = await createBalancedJournalEntry({
    tx: input.tx,
    entryDate: date,
    memo: `Payment for General Expense: ${expense.payeeName}`,
    sourceType: "general_expense",
    sourceId: expense.id,
    createdBy: input.createdBy,
    lines: [
      {
        accountCode: "accounts_payable_general",
        debit: Number(expense.amount),
        credit: 0,
      },
      {
        accountCode: input.paymentAssetAccountCode,
        debit: 0,
        credit: Number(expense.amount),
      },
    ],
  });

  return { journalEntryId: journalResult.entryId };
}
