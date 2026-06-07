"use server";

import { desc, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { requireOwner } from "@/lib/auth/validate";
import { getDb } from "@/lib/db";
import { generalExpenses } from "@/lib/db/schema";
import type { LedgerAccountCode } from "@/lib/domain/finance";
import {
  CASH_ACCOUNT_CODES,
  OPERATING_EXPENSE_ACCOUNT_CODES,
  type OperatingExpenseAccountCode,
} from "@/lib/domain/finance";
import { mapPaymentMethodToAccount, type PaymentMethodPreset } from "@/lib/domain/payment";
import { invalidateFinanceCacheForWrite } from "@/lib/finance/cache-invalidation";
import { payGeneralExpense, recordGeneralExpense } from "@/lib/finance/expenses";
import { type ActionResponse, successResponse } from "@/lib/utils/action-response";
import { handleActionError } from "@/lib/utils/error";

const expenseAccountCodes = [...OPERATING_EXPENSE_ACCOUNT_CODES] as [string, ...string[]];
const cashAccountCodes = [...CASH_ACCOUNT_CODES] as [string, ...string[]];

const createExpenseSchema = z.object({
  payeeName: z.string().min(1, "Payee name is required"),
  amount: z.number().positive("Amount must be positive"),
  expenseAccountCode: z.enum(expenseAccountCodes),
  expenseDate: z.string().optional(),
  paymentMethodId: z.string().nullable().optional(),
  paymentAssetAccountCode: z.enum(cashAccountCodes).nullable().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

const payExpenseSchema = z.object({
  expenseId: z.string().uuid(),
  paymentMethodId: z.string().uuid(),
  paymentDate: z.string().optional(),
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
  ytdTotal: number;
};

export async function getExpensesData(): Promise<ActionResponse<ExpenseData>> {
  try {
    await requireOwner();
    const db = await getDb();

    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const [recentExpenses, expenseAccounts, activePaymentMethods, ytdAggregate] = await Promise.all(
      [
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
        db
          .select({
            sum: sql<number>`coalesce(sum(${generalExpenses.amount}::numeric), 0)`.as("sum"),
          })
          .from(generalExpenses)
          .where(gte(generalExpenses.expenseDate, yearStart)),
      ],
    );

    const ytdTotal = Math.round(ytdAggregate[0]?.sum ?? 0);

    return successResponse({
      expenses: recentExpenses,
      expenseAccounts: expenseAccounts.filter((a) =>
        (OPERATING_EXPENSE_ACCOUNT_CODES as readonly string[]).includes(a.code),
      ),
      paymentMethods: activePaymentMethods,
      ytdTotal,
    });
  } catch (error) {
    return handleActionError(error, "getExpensesData", "Failed to fetch expenses data");
  }
}

async function resolvePaymentAssetAccount(
  db: Awaited<ReturnType<typeof getDb>>,
  paymentMethodId: string | null,
  paymentAssetAccountCode: LedgerAccountCode | null,
): Promise<LedgerAccountCode | undefined> {
  if (!paymentMethodId) return undefined;

  const method = await db.query.paymentMethods.findFirst({
    where: (pm, { eq }) => eq(pm.id, paymentMethodId),
    columns: { name: true, isActive: true },
  });

  if (!method) {
    throw new Error("Payment method not found");
  }

  if (!method.isActive) {
    throw new Error("Payment method is not active");
  }

  try {
    return mapPaymentMethodToAccount(method.name as PaymentMethodPreset);
  } catch {
    if (
      paymentAssetAccountCode &&
      (CASH_ACCOUNT_CODES as readonly string[]).includes(paymentAssetAccountCode)
    ) {
      return paymentAssetAccountCode;
    }
    throw new Error(`Unsupported payment method: ${method.name}`);
  }
}

export async function submitGeneralExpense(
  formData: FormData,
): Promise<ActionResponse<{ expenseId: string; journalEntryId: string | null }>> {
  try {
    const sessionUser = await requireOwner();

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

    const resolvedAssetAccount = await resolvePaymentAssetAccount(
      db,
      parsed.paymentMethodId ?? null,
      parsed.paymentAssetAccountCode as LedgerAccountCode | null,
    );

    const result = await db.transaction(async (tx) => {
      return recordGeneralExpense({
        tx,
        payeeName: parsed.payeeName,
        amount: parsed.amount,
        expenseAccountCode: parsed.expenseAccountCode as OperatingExpenseAccountCode,
        expenseDate: parsed.expenseDate ? new Date(parsed.expenseDate) : new Date(),
        paymentMethodId: parsed.paymentMethodId || null,
        paymentAssetAccountCode: resolvedAssetAccount,
        reference: parsed.reference || null,
        notes: parsed.notes || null,
        createdBy: sessionUser.userId,
      });
    });

    await invalidateFinanceCacheForWrite();
    return successResponse(result);
  } catch (error) {
    return handleActionError(error, "submitGeneralExpense", "Failed to submit expense");
  }
}

export async function payGeneralExpenseAction(
  formData: FormData,
): Promise<ActionResponse<{ journalEntryId: string }>> {
  try {
    const sessionUser = await requireOwner();

    const rawData = {
      expenseId: formData.get("expenseId"),
      paymentMethodId: formData.get("paymentMethodId"),
      paymentDate: formData.get("paymentDate"),
      reference: formData.get("reference"),
      notes: formData.get("notes"),
    };

    const parsed = payExpenseSchema.parse({
      expenseId: typeof rawData.expenseId === "string" ? rawData.expenseId : "",
      paymentMethodId: typeof rawData.paymentMethodId === "string" ? rawData.paymentMethodId : "",
      paymentDate: typeof rawData.paymentDate === "string" ? rawData.paymentDate : undefined,
      reference: typeof rawData.reference === "string" ? rawData.reference : undefined,
      notes: typeof rawData.notes === "string" ? rawData.notes : undefined,
    });

    const db = await getDb();

    const method = await db.query.paymentMethods.findFirst({
      where: (pm, { eq }) => eq(pm.id, parsed.paymentMethodId),
      columns: { name: true, isActive: true },
    });

    if (!method) {
      throw new Error("Payment method not found");
    }

    if (!method.isActive) {
      throw new Error("Payment method is not active");
    }

    const paymentAssetAccountCode = mapPaymentMethodToAccount(method.name as PaymentMethodPreset);

    const result = await db.transaction(async (tx) => {
      return payGeneralExpense({
        tx,
        expenseId: parsed.expenseId,
        paymentMethodId: parsed.paymentMethodId,
        paymentAssetAccountCode,
        paymentDate: parsed.paymentDate ? new Date(parsed.paymentDate) : new Date(),
        reference: parsed.reference || null,
        createdBy: sessionUser.userId,
      });
    });

    await invalidateFinanceCacheForWrite();
    return successResponse(result);
  } catch (error) {
    return handleActionError(error, "payGeneralExpenseAction", "Failed to pay expense");
  }
}
