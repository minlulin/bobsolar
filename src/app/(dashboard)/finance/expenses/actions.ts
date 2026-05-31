"use server";

import { desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/validate";
import { getDb } from "@/lib/db";
import { generalExpenses } from "@/lib/db/schema";
import {
  type LedgerAccountCode,
  OPERATING_EXPENSE_ACCOUNT_CODES,
  type OperatingExpenseAccountCode,
} from "@/lib/domain/finance";
import { recordGeneralExpense } from "@/lib/finance/expenses";

const createExpenseSchema = z.object({
  payeeName: z.string().min(1, "Payee name is required"),
  amount: z.number().positive("Amount must be positive"),
  expenseAccountCode: z.enum(OPERATING_EXPENSE_ACCOUNT_CODES as unknown as [string, ...string[]]),
  expenseDate: z.string().optional(),
  paymentMethodId: z.string().nullable().optional(),
  paymentAssetAccountCode: z.string().nullable().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

export async function getExpensesData() {
  await requireAuth();
  const db = await getDb();

  // Get recent expenses
  const recentExpenses = await db.query.generalExpenses.findMany({
    orderBy: [desc(generalExpenses.expenseDate)],
    limit: 50,
    with: {
      account: {
        columns: { name: true, code: true },
      },
      paymentMethod: {
        columns: { name: true },
      },
    },
  });

  // Get expense accounts
  const expenseAccounts = await db.query.ledgerAccounts.findMany({
    where: (accounts, { eq }) => eq(accounts.type, "expense"),
    orderBy: (accounts, { asc }) => [asc(accounts.name)],
  });

  // Get active payment methods
  const activePaymentMethods = await db.query.paymentMethods.findMany({
    where: (methods, { eq }) => eq(methods.isActive, true),
    orderBy: (methods, { asc }) => [asc(methods.name)],
  });

  return {
    expenses: recentExpenses,
    expenseAccounts: expenseAccounts.filter((a) =>
      (OPERATING_EXPENSE_ACCOUNT_CODES as readonly string[]).includes(a.code),
    ),
    paymentMethods: activePaymentMethods,
  };
}

export async function submitGeneralExpense(formData: FormData) {
  const sessionUser = await requireAuth();

  const rawData = {
    payeeName: formData.get("payeeName") as string,
    amount: parseFloat(formData.get("amount") as string),
    expenseAccountCode: formData.get("expenseAccountCode") as string,
    expenseDate: formData.get("expenseDate") as string,
    paymentMethodId: (formData.get("paymentMethodId") as string) || null,
    paymentAssetAccountCode: (formData.get("paymentAssetAccountCode") as string) || null,
    reference: formData.get("reference") as string,
    notes: formData.get("notes") as string,
  };

  const parsed = createExpenseSchema.parse(rawData);

  const db = await getDb();

  await db.transaction(async (tx) => {
    await recordGeneralExpense({
      tx,
      payeeName: parsed.payeeName,
      amount: parsed.amount,
      expenseAccountCode: parsed.expenseAccountCode as OperatingExpenseAccountCode,
      expenseDate: parsed.expenseDate ? new Date(parsed.expenseDate) : new Date(),
      paymentMethodId: parsed.paymentMethodId || null,
      paymentAssetAccountCode: (parsed.paymentAssetAccountCode as LedgerAccountCode) || undefined,
      reference: parsed.reference || null,
      notes: parsed.notes || null,
      createdBy: sessionUser.userId,
    });
  });

  revalidatePath("/finance/expenses");
  return { success: true };
}
