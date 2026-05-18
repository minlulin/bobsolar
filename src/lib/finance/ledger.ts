import { inArray } from "drizzle-orm";
import type { getDb } from "@/lib/db";
import { journalEntries, journalLines, ledgerAccounts } from "@/lib/db/schema";
import {
  COST_TYPES,
  type CostType,
  type JournalSourceType,
  LEDGER_ACCOUNT_CODE_TYPE_MAP,
  LEDGER_ACCOUNT_CODES,
  LEDGER_ACCOUNT_LABELS,
  type LedgerAccountCode,
  PAYMENT_METHOD_PRESETS,
} from "@/lib/domain/enums";

type DbClient = ReturnType<typeof getDb>;
type DbTransaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];

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
  sourceId: string;
  projectId?: string | null;
  createdBy: string;
  lines: readonly JournalLineInput[];
};

function normalizeMethodName(value: string): string {
  return value.trim().toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
}

export function mapPaymentMethodNameToAssetAccount(methodName: string): LedgerAccountCode | null {
  const normalized = normalizeMethodName(methodName);
  if (normalized === "cash") return "cash_on_hand";
  if (normalized === "kbz_pay" || normalized === "kbzpay") return "kbz_wallet";
  if (normalized === "wave_pay" || normalized === "wavepay") return "wave_wallet";
  if (normalized === "aya_pay" || normalized === "ayapay") return "aya_wallet";
  if (normalized === "bank_transfer" || normalized === "bank") {
    return "bank_account";
  }
  return null;
}

export function mapCostTypeToExpenseAccount(costType: CostType): LedgerAccountCode {
  if (costType === "material") return "material_expense";
  if (costType === "labor") return "labor_expense";
  if (costType === "transport") return "transport_expense";
  return "misc_expense";
}

export function assertFinanceSsotDrift(): void {
  const methodSet = new Set(PAYMENT_METHOD_PRESETS);
  if (
    !methodSet.has("cash") ||
    !methodSet.has("kbz_pay") ||
    !methodSet.has("wave_pay") ||
    !methodSet.has("aya_pay") ||
    !methodSet.has("bank_transfer")
  ) {
    throw new Error("Finance SSoT drift: required payment methods are missing.");
  }

  const costSet = new Set(COST_TYPES);
  for (const required of ["material", "labor", "transport", "misc"] as const) {
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

  await ensureLedgerAccountsSeeded(input.tx);

  const neededCodes = input.lines.map((line) => line.accountCode);
  const accounts = await input.tx
    .select({
      id: ledgerAccounts.id,
      code: ledgerAccounts.code,
      isActive: ledgerAccounts.isActive,
    })
    .from(ledgerAccounts)
    .where(inArray(ledgerAccounts.code, neededCodes));

  if (accounts.length !== neededCodes.length) {
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
      entryDate: input.entryDate ?? new Date(),
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
