import { z } from "zod";

export const LEDGER_ACCOUNT_TYPES = ["asset", "liability", "equity", "income", "expense"] as const;

export type LedgerAccountType = (typeof LEDGER_ACCOUNT_TYPES)[number];
export const ledgerAccountTypeSchema = z.enum(LEDGER_ACCOUNT_TYPES);

export const LEDGER_ACCOUNT_CODES = [
  "cash_on_hand",
  "kbz_wallet",
  "wave_wallet",
  "aya_wallet",
  "bank_account",
  "accounts_receivable",
  "accounts_payable",
  "owner_equity",
  "solar_installation_revenue",
  "other_income",
  "raw_materials",
  "material_expense",
  "labor_expense",
  "transport_expense",
  "misc_expense",
  "general_expense",
] as const;

export type LedgerAccountCode = (typeof LEDGER_ACCOUNT_CODES)[number];
export const ledgerAccountCodeSchema = z.enum(LEDGER_ACCOUNT_CODES);

export const LEDGER_ACCOUNT_CODE_TYPE_MAP: Record<LedgerAccountCode, LedgerAccountType> = {
  cash_on_hand: "asset",
  kbz_wallet: "asset",
  wave_wallet: "asset",
  aya_wallet: "asset",
  bank_account: "asset",
  accounts_receivable: "asset",
  accounts_payable: "liability",
  owner_equity: "equity",
  solar_installation_revenue: "income",
  other_income: "income",
  raw_materials: "asset",
  material_expense: "expense",
  labor_expense: "expense",
  transport_expense: "expense",
  misc_expense: "expense",
  general_expense: "expense",
};

export const LEDGER_ACCOUNT_LABELS: Record<LedgerAccountCode, string> = {
  cash_on_hand: "Cash on Hand",
  kbz_wallet: "KBZ Wallet",
  wave_wallet: "Wave Wallet",
  aya_wallet: "AYA Wallet",
  bank_account: "Bank Account",
  accounts_receivable: "Accounts Receivable",
  accounts_payable: "Accounts Payable",
  owner_equity: "Owner Equity",
  solar_installation_revenue: "Solar Installation Revenue",
  other_income: "Other Income",
  raw_materials: "Raw Materials",
  material_expense: "Material Expense",
  labor_expense: "Labor Expense",
  transport_expense: "Transport Expense",
  misc_expense: "Misc Expense",
  general_expense: "General Expense",
};

export const JOURNAL_SOURCE_TYPES = [
  "project_payment",
  "project_expense",
  "manual_adjustment",
  "opening_balance",
  "backfill",
] as const;

export type JournalSourceType = (typeof JOURNAL_SOURCE_TYPES)[number];
export const journalSourceTypeSchema = z.enum(JOURNAL_SOURCE_TYPES);

export const FINANCE_TRANSACTION_TYPES = ["income", "expense"] as const;
export type FinanceTransactionType = (typeof FINANCE_TRANSACTION_TYPES)[number];
export const financeTransactionTypeSchema = z.enum(FINANCE_TRANSACTION_TYPES);

export const PROJECT_EXPENSE_TYPES = ["material", "labor", "transport", "misc", "general"] as const;

export type ProjectExpenseType = (typeof PROJECT_EXPENSE_TYPES)[number];
export const projectExpenseTypeSchema = z.enum(PROJECT_EXPENSE_TYPES);
