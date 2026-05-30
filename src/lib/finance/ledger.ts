import { eq, inArray } from "drizzle-orm";
import type { getDb } from "@/lib/db";
import {
  accountingPeriods,
  type CostType,
  type JournalSourceType,
  journalEntries,
  journalLines,
  ledgerAccounts,
} from "@/lib/db/schema";
import { COST_TYPES } from "@/lib/domain/cost-types";
import {
  LEDGER_ACCOUNT_CODE_TYPE_MAP,
  LEDGER_ACCOUNT_CODES,
  LEDGER_ACCOUNT_LABELS,
  type LedgerAccountCode,
} from "@/lib/domain/finance";
import { PAYMENT_METHOD_PRESETS } from "@/lib/domain/payment";

export type DbClient = ReturnType<typeof getDb>;
export type DbTransaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];

type JournalLineInput = {
  accountCode: LedgerAccountCode;
  debit: number;
  credit: number;
  memo?: string | null;
};

type CreateJournalEntryInput = {
  tx: DbTransaction;
  entryDate?: Date;
  memo?: string | null;
  sourceType: JournalSourceType;
  sourceId: string | null;
  projectId?: string | null;
  createdBy: string;
  lines: readonly JournalLineInput[];
  overridePeriodLock?: boolean;
};

function normalizeMethodName(value: string): string {
  return value.trim().toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
}

export function mapPaymentMethodNameToAssetAccount(methodName: string): LedgerAccountCode | null {
  const normalized = normalizeMethodName(methodName);
  if (normalized === "cash") return "cash_on_hand";
  if (normalized === "kbz_banking" || normalized === "kbzbanking") return "kbz_banking";
  if (normalized === "kbz_pay" || normalized === "kbzpay") return "kbz_wallet";
  if (normalized === "aya_banking" || normalized === "ayabanking") return "aya_banking";
  if (normalized === "aya_pay" || normalized === "ayapay") return "aya_wallet";
  if (normalized === "cb_banking" || normalized === "cbbanking") return "cb_banking";
  if (normalized === "cb_pay" || normalized === "cbpay") return "cb_wallet";
  if (normalized === "wave_pay" || normalized === "wavepay") return "wave_wallet";
  // Legacy alias for backward compatibility
  if (normalized === "bank_transfer" || normalized === "bank") return "kbz_banking";
  return null;
}

export function mapCostTypeToExpenseAccount(costType: CostType): LedgerAccountCode {
  if (costType === "material") return "material_expense";
  if (costType === "labor") return "labor_expense";
  if (costType === "transport") return "transport_expense";
  if (costType === "general") return "general_expense";
  return "misc_expense";
}

export function assertFinanceSsotDrift(): void {
  const methodSet = new Set(PAYMENT_METHOD_PRESETS);
  const requiredMethods = [
    "cash",
    "kbz_banking",
    "kbz_pay",
    "aya_banking",
    "aya_pay",
    "cb_banking",
    "cb_pay",
    "wave_pay",
  ] as const;
  for (const method of requiredMethods) {
    if (!methodSet.has(method)) {
      throw new Error(`Finance SSoT drift: required payment method '${method}' is missing.`);
    }
  }

  const costSet = new Set(COST_TYPES);
  for (const required of ["material", "labor", "transport", "misc", "general"] as const) {
    if (!costSet.has(required)) {
      throw new Error(`Finance SSoT drift: missing cost type '${required}'.`);
    }
  }
}

export async function ensureLedgerAccountsSeeded(tx: DbTransaction): Promise<void> {
  const existing = await tx
    .select({ code: ledgerAccounts.code })
    .from(ledgerAccounts)
    .where(inArray(ledgerAccounts.code, [...LEDGER_ACCOUNT_CODES]));

  const existingCodes = new Set(existing.map((row) => row.code));
  const missingValues = LEDGER_ACCOUNT_CODES.filter((code) => !existingCodes.has(code)).map(
    (code) => ({
      code,
      name: LEDGER_ACCOUNT_LABELS[code],
      type: LEDGER_ACCOUNT_CODE_TYPE_MAP[code],
      isActive: true,
    }),
  );

  if (missingValues.length > 0) {
    await tx.insert(ledgerAccounts).values(missingValues);
  }
}

export async function createBalancedJournalEntry(
  input: CreateJournalEntryInput,
): Promise<{ entryId: string }> {
  if (input.lines.length < 2) {
    throw new Error("Journal entry requires at least two lines.");
  }

  let totalDebit = 0;
  let totalCredit = 0;
  for (const line of input.lines) {
    if (line.debit < 0 || line.credit < 0) {
      throw new Error("Journal line values must be non-negative.");
    }
    const hasDebit = line.debit > 0;
    const hasCredit = line.credit > 0;
    if ((hasDebit && hasCredit) || (!hasDebit && !hasCredit)) {
      throw new Error("Journal line must be debit-only or credit-only.");
    }
    totalDebit += Math.round(line.debit);
    totalCredit += Math.round(line.credit);
  }

  if (totalDebit !== totalCredit) {
    throw new Error(`Unbalanced journal entry: debit=${totalDebit}, credit=${totalCredit}.`);
  }

  const dateToCheck = input.entryDate ?? new Date();
  const periodMonth = dateToCheck.toISOString().slice(0, 7);

  if (!input.overridePeriodLock) {
    const period = await input.tx.query.accountingPeriods.findFirst({
      where: eq(accountingPeriods.periodMonth, periodMonth),
    });
    if (period && (period.status === "soft_closed" || period.status === "closed")) {
      throw new Error(`Accounting period ${periodMonth} is locked for this date.`);
    }
  }

  await ensureLedgerAccountsSeeded(input.tx);

  const uniqueNeededCodes = Array.from(new Set(input.lines.map((line) => line.accountCode)));
  const accounts = await input.tx
    .select({
      id: ledgerAccounts.id,
      code: ledgerAccounts.code,
      isActive: ledgerAccounts.isActive,
    })
    .from(ledgerAccounts)
    .where(inArray(ledgerAccounts.code, uniqueNeededCodes));

  if (accounts.length !== uniqueNeededCodes.length) {
    throw new Error("Some ledger accounts are missing from DB.");
  }

  const accountIdByCode = new Map(accounts.map((a) => [a.code, a.id]));
  const inactive = accounts.find((a) => !a.isActive);
  if (inactive) {
    throw new Error(`Ledger account '${inactive.code}' is inactive.`);
  }

  const [entry] = await input.tx
    .insert(journalEntries)
    .values({
      entryDate: dateToCheck,
      memo: input.memo ?? null,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      createdBy: input.createdBy,
    })
    .returning({ id: journalEntries.id });

  if (!entry) {
    throw new Error("Failed to create journal entry row.");
  }

  const lineValues = input.lines.map((line) => ({
    entryId: entry.id,
    accountId: accountIdByCode.get(line.accountCode) ?? "",
    projectId: input.projectId ?? null,
    debit: String(Math.round(line.debit)),
    credit: String(Math.round(line.credit)),
    memo: line.memo ?? null,
  }));

  const invalidRow = lineValues.find((row) => row.accountId.length === 0);
  if (invalidRow) {
    throw new Error("Unable to resolve account ID for journal line.");
  }

  await input.tx.insert(journalLines).values(lineValues);
  return { entryId: entry.id };
}

export async function getJournalEntryWithLines(
  tx: DbTransaction,
  entryId: string,
): Promise<{
  id: string;
  sourceType: JournalSourceType;
  sourceId: string | null;
  memo: string | null;
  createdBy: string;
  entryDate: Date;
  lines: {
    id: string;
    accountId: string;
    accountCode: LedgerAccountCode;
    debit: number;
    credit: number;
    memo: string | null;
  }[];
} | null> {
  const entry = await tx.query.journalEntries.findFirst({
    where: eq(journalEntries.id, entryId),
    with: {
      lines: {
        with: {
          account: {
            columns: {
              id: true,
              code: true,
            },
          },
        },
      },
    },
  });

  if (!entry) return null;

  return {
    id: entry.id,
    sourceType: entry.sourceType,
    sourceId: entry.sourceId,
    memo: entry.memo,
    createdBy: entry.createdBy,
    entryDate: entry.entryDate,
    lines: entry.lines.map((line) => ({
      id: line.id,
      accountId: line.accountId,
      accountCode: line.account.code as LedgerAccountCode,
      debit: Math.round(Number(line.debit)),
      credit: Math.round(Number(line.credit)),
      memo: line.memo,
    })),
  };
}

export async function reverseJournalEntry(input: {
  tx: DbTransaction;
  originalEntryId: string;
  memo?: string | null;
  createdBy: string;
}): Promise<{ entryId: string }> {
  await assertJournalEntryNotReversed(input.tx, input.originalEntryId);

  const original = await getJournalEntryWithLines(input.tx, input.originalEntryId);
  if (!original) {
    throw new Error("Original journal entry not found.");
  }

  const reversedLines = original.lines.map((line) => ({
    accountCode: line.accountCode,
    debit: line.credit,
    credit: line.debit,
    memo: line.memo ? `Reversal: ${line.memo}` : "Reversal",
  }));

  const reversalMemo =
    input.memo ?? `Reversal of ${original.sourceType} entry (${original.id.slice(0, 8)}...)`;

  const result = await createBalancedJournalEntry({
    tx: input.tx,
    entryDate: new Date(),
    memo: reversalMemo,
    sourceType: "manual_adjustment",
    sourceId: original.id,
    createdBy: input.createdBy,
    lines: reversedLines,
  });

  await input.tx
    .update(journalEntries)
    .set({
      isReversed: true,
      reversedBy: input.createdBy,
    })
    .where(eq(journalEntries.id, input.originalEntryId));

  return result;
}

export async function assertJournalEntryNotReversed(
  tx: DbTransaction,
  entryId: string,
): Promise<void> {
  const entry = await tx.query.journalEntries.findFirst({
    where: eq(journalEntries.id, entryId),
    columns: { isReversed: true },
  });

  if (entry?.isReversed) {
    throw new Error("Journal entry has already been reversed.");
  }
}

export function assertJournalImmutability(operation: "update" | "delete"): never {
  throw new Error(`Journal entries are immutable. Use reversal flow instead of ${operation}.`);
}
