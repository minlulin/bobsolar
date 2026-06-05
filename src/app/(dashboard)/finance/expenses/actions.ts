"use server";

import { desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireFinanceAccess } from "@/lib/auth/validate";
import { getDb } from "@/lib/db";
import { generalExpenses } from "@/lib/db/schema";
import type { LedgerAccountCode } from "@/lib/domain/finance";
import {
  OPERATING_EXPENSE_ACCOUNT_CODES,
  type OperatingExpenseAccountCode,
} from "@/lib/domain/finance";
import { recordGeneralExpense } from "@/lib/finance/expenses";
import { type ActionResponse, successResponse } from "@/lib/utils/action-response";
import { handleActionError } from "@/lib/utils/error";

const expenseAccountCodes = [...OPERATING_EXPENSE_ACCOUNT_CODES] as [string, ...string[]];

const createExpenseSchema = z.object({
  payeeName: z.string().min(1, "Payee name is required"),
  amount: z.number().positive("Amount must be positive"),
  expenseAccountCode: z.enum(expenseAccountCodes),
  expenseDate: z.string().optional(),
  paymentMethodId: z.string().nullable().optional(),
  paymentAssetAccountCode: z.string().nullable().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

type ExpenseData = {
  expenses: Array<{
    id: string;
    payeeName: string;
    amount: string;
    expenseDate: Date | null;
    isPaid: boolean;
    reference: string | null;
    notes: string | null;
    account: { name: string; code: string } | null;
    paymentMethod: { name: string } | null;
  }>;
  expenseAccounts: Array<{
    id: string;
    code: string;
    name: string;
    type: string;
  }>;
  paymentMethods: Array<{
    id: string;
    name: string;
    isActive: boolean;
  }>;
};

export async function getExpensesData(): Promise<ActionResponse<ExpenseData>> {
  try {
    await requireFinanceAccess();
    const db = await getDb();

    const [recentExpenses, expenseAccounts, activePaymentMethods] = await Promise.all([
      db.query.generalExpenses.findMany({
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
      }),
      db.query.ledgerAccounts.findMany({
        where: (accounts, { eq }) => eq(accounts.type, "expense"),
        orderBy: (accounts, { asc }) => [asc(accounts.name)],
      }),
      db.query.paymentMethods.findMany({
        where: (methods, { eq }) => eq(methods.isActive, true),
        orderBy: (methods, { asc }) => [asc(methods.name)],
      }),
    ]);

    return successResponse({
      expenses: recentExpenses,
      expenseAccounts: expenseAccounts.filter((a) =>
        (OPERATING_EXPENSE_ACCOUNT_CODES as readonly string[]).includes(a.code),
      ),
      paymentMethods: activePaymentMethods,
    });
  } catch (error) {
    return handleActionError(error, "getExpensesData", "Failed to fetch expenses data");
  }
}

export async function submitGeneralExpense(
  formData: FormData,
): Promise<ActionResponse<{ expenseId: string; journalEntryId: string | null }>> {
  try {
    const sessionUser = await requireFinanceAccess();

    const rawData = {
      payeeName: formData.get("payeeName"),
      amount: formData.get("amount"),
      expenseAccountCode: formData.get("expenseAccountCode"),
      expenseDate: formData.get("expenseDate"),
      paymentMethodId: formData.get("paymentMethodId") || null,
      paymentAssetAccountCode: formData.get("paymentAssetAccountCode") || null,
      reference: formData.get("reference"),
      notes: formData.get("notes"),
    };

    const parsed = createExpenseSchema.parse({
      payeeName: typeof rawData.payeeName === "string" ? rawData.payeeName : "",
      amount: typeof rawData.amount === "string" ? parseFloat(rawData.amount) : 0,
      expenseAccountCode:
        typeof rawData.expenseAccountCode === "string" ? rawData.expenseAccountCode : "",
      expenseDate: typeof rawData.expenseDate === "string" ? rawData.expenseDate : undefined,
      paymentMethodId: rawData.paymentMethodId,
      paymentAssetAccountCode: rawData.paymentAssetAccountCode,
      reference: typeof rawData.reference === "string" ? rawData.reference : undefined,
      notes: typeof rawData.notes === "string" ? rawData.notes : undefined,
    });

    const db = await getDb();

    const result = await db.transaction(async (tx) => {
      return recordGeneralExpense({
        tx,
        payeeName: parsed.payeeName,
        amount: parsed.amount,
        expenseAccountCode: parsed.expenseAccountCode as OperatingExpenseAccountCode,
        expenseDate: parsed.expenseDate ? new Date(parsed.expenseDate) : new Date(),
        paymentMethodId: parsed.paymentMethodId || null,
        paymentAssetAccountCode: (parsed.paymentAssetAccountCode || undefined) as
          | LedgerAccountCode
          | undefined,
        reference: parsed.reference || null,
        notes: parsed.notes || null,
        createdBy: sessionUser.userId,
      });
    });

    revalidatePath("/finance/expenses");
    return successResponse(result);
  } catch (error) {
    return handleActionError(error, "submitGeneralExpense", "Failed to submit expense");
  }
}
