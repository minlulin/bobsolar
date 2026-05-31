import { z } from "zod";
import {
  type JournalSourceType,
  journalSourceTypeEnum,
  type LedgerAccountType,
  ledgerAccountTypeEnum,
} from "@/lib/db/schema";

export const LEDGER_ACCOUNT_TYPES = ledgerAccountTypeEnum.enumValues;

export const ledgerAccountTypeSchema = z.enum(LEDGER_ACCOUNT_TYPES);

export const LEDGER_ACCOUNT_CODES = [
  "cash_on_hand",
  "kbz_banking",
  "kbz_wallet",
  "aya_banking",
  "aya_wallet",
  "cb_banking",
  "cb_wallet",
  "wave_wallet",
  "accounts_receivable",
  "accounts_payable",
  "customer_deposits",
  "owner_equity",
  "solar_installation_revenue",
  "other_income",
  "raw_materials",
  "cost_of_goods_sold",
  "material_expense",
  "labor_expense",
  "transport_expense",
  "misc_expense",
  "general_expense",
  "rent_expense",
  "utilities_expense",
  "payroll_expense",
  "tax_expense",
  "office_supplies",
  "software_subscriptions",
  "accounts_payable_general",
  "payroll_taxes_payable",
  "retained_earnings",
  "owner_a_capital",
  "owner_a_draws",
  "owner_a_distributions_payable",
  "owner_b_capital",
  "owner_b_draws",
  "owner_b_distributions_payable",
  "owner_c_capital",
  "owner_c_draws",
  "owner_c_distributions_payable",
] as const;

export const CASH_ACCOUNT_CODES = [
  "cash_on_hand",
  "kbz_banking",
  "kbz_wallet",
  "aya_banking",
  "aya_wallet",
  "cb_banking",
  "cb_wallet",
  "wave_wallet",
] as const satisfies readonly LedgerAccountCode[];

export const CASH_ACCOUNT_GROUPS = {
  cash: ["cash_on_hand"] as const,
  wallet: ["kbz_wallet", "aya_wallet", "cb_wallet", "wave_wallet"] as const,
  banking: ["kbz_banking", "aya_banking", "cb_banking"] as const,
} as const satisfies Record<string, readonly LedgerAccountCode[]>;

export type CashAccountGroup = keyof typeof CASH_ACCOUNT_GROUPS;

export const CASH_ACCOUNT_GROUP_LABELS: Record<CashAccountGroup, string> = {
  cash: "Cash on Hand",
  wallet: "Digital Wallets",
  banking: "Bank Accounts",
};

export const REVENUE_ACCOUNT_CODES = [
  "solar_installation_revenue",
  "other_income",
] as const satisfies readonly LedgerAccountCode[];

export const OPERATING_EXPENSE_ACCOUNT_CODES = [
  "material_expense",
  "labor_expense",
  "transport_expense",
  "misc_expense",
  "general_expense",
  "rent_expense",
  "utilities_expense",
  "payroll_expense",
  "tax_expense",
  "office_supplies",
  "software_subscriptions",
] as const satisfies readonly LedgerAccountCode[];

export type OperatingExpenseAccountCode = (typeof OPERATING_EXPENSE_ACCOUNT_CODES)[number];

export const EXPENSE_ACCOUNT_SHORT_LABELS: Record<OperatingExpenseAccountCode, string> = {
  material_expense: "Materials",
  labor_expense: "Labor",
  transport_expense: "Logistics",
  misc_expense: "Miscellaneous",
  general_expense: "General",
  rent_expense: "Rent",
  utilities_expense: "Utilities",
  payroll_expense: "Payroll",
  tax_expense: "Taxes",
  office_supplies: "Supplies",
  software_subscriptions: "Software",
};

export const COGS_ACCOUNT_CODES = [
  "cost_of_goods_sold",
] as const satisfies readonly LedgerAccountCode[];

export const CURRENT_ASSET_ACCOUNT_CODES = [
  ...CASH_ACCOUNT_CODES,
  "accounts_receivable",
  "raw_materials",
] as const satisfies readonly LedgerAccountCode[];

export const CURRENT_LIABILITY_ACCOUNT_CODES = [
  "accounts_payable",
  "customer_deposits",
  "accounts_payable_general",
  "payroll_taxes_payable",
  "owner_a_distributions_payable",
  "owner_b_distributions_payable",
  "owner_c_distributions_payable",
] as const satisfies readonly LedgerAccountCode[];

export function isLedgerAccountCode(value: string): value is LedgerAccountCode {
  return (LEDGER_ACCOUNT_CODES as readonly string[]).includes(value);
}

export type LedgerAccountCode = (typeof LEDGER_ACCOUNT_CODES)[number];
export const ledgerAccountCodeSchema = z.enum(LEDGER_ACCOUNT_CODES);

export const LEDGER_ACCOUNT_CODE_TYPE_MAP: Record<LedgerAccountCode, LedgerAccountType> = {
  cash_on_hand: "asset",
  kbz_banking: "asset",
  kbz_wallet: "asset",
  aya_banking: "asset",
  aya_wallet: "asset",
  cb_banking: "asset",
  cb_wallet: "asset",
  wave_wallet: "asset",
  accounts_receivable: "asset",
  accounts_payable: "liability",
  customer_deposits: "liability",
  owner_equity: "equity",
  solar_installation_revenue: "income",
  other_income: "income",
  raw_materials: "asset",
  cost_of_goods_sold: "expense",
  material_expense: "expense",
  labor_expense: "expense",
  transport_expense: "expense",
  misc_expense: "expense",
  general_expense: "expense",
  rent_expense: "expense",
  utilities_expense: "expense",
  payroll_expense: "expense",
  tax_expense: "expense",
  office_supplies: "expense",
  software_subscriptions: "expense",
  accounts_payable_general: "liability",
  payroll_taxes_payable: "liability",
  retained_earnings: "equity",
  owner_a_capital: "equity",
  owner_a_draws: "equity",
  owner_a_distributions_payable: "liability",
  owner_b_capital: "equity",
  owner_b_draws: "equity",
  owner_b_distributions_payable: "liability",
  owner_c_capital: "equity",
  owner_c_draws: "equity",
  owner_c_distributions_payable: "liability",
};

export const LEDGER_ACCOUNT_LABELS: Record<LedgerAccountCode, string> = {
  cash_on_hand: "Cash on Hand",
  kbz_banking: "KBZ Bank Account",
  kbz_wallet: "KBZ Pay Wallet",
  aya_banking: "AYA Bank Account",
  aya_wallet: "AYA Pay Wallet",
  cb_banking: "CB Bank Account",
  cb_wallet: "CB Pay Wallet",
  wave_wallet: "Wave Pay Wallet",
  accounts_receivable: "Accounts Receivable",
  accounts_payable: "Accounts Payable",
  customer_deposits: "Customer Deposits",
  owner_equity: "Owner Equity",
  solar_installation_revenue: "Solar Installation Revenue",
  other_income: "Other Income",
  raw_materials: "Raw Materials",
  cost_of_goods_sold: "Cost of Goods Sold",
  material_expense: "Material Expense",
  labor_expense: "Labor Expense",
  transport_expense: "Transport Expense",
  misc_expense: "Misc Expense",
  general_expense: "General Expense",
  rent_expense: "Rent Expense",
  utilities_expense: "Utilities Expense",
  payroll_expense: "Payroll Expense",
  tax_expense: "Tax Expense",
  office_supplies: "Office Supplies",
  software_subscriptions: "Software Subscriptions",
  accounts_payable_general: "Accounts Payable - General",
  payroll_taxes_payable: "Payroll Taxes Payable",
  retained_earnings: "Retained Earnings",
  owner_a_capital: "Owner A - Capital Contributions",
  owner_a_draws: "Owner A - Draws",
  owner_a_distributions_payable: "Owner A - Distributions Payable",
  owner_b_capital: "Owner B - Capital Contributions",
  owner_b_draws: "Owner B - Draws",
  owner_b_distributions_payable: "Owner B - Distributions Payable",
  owner_c_capital: "Owner C - Capital Contributions",
  owner_c_draws: "Owner C - Draws",
  owner_c_distributions_payable: "Owner C - Distributions Payable",
};

export const JOURNAL_SOURCE_TYPES = journalSourceTypeEnum.enumValues;
export type { JournalSourceType } from "@/lib/db/schema";

export const journalSourceTypeSchema = z.enum(JOURNAL_SOURCE_TYPES);

export const OPERATING_SOURCE_TYPES = [
  "project_payment",
  "project_expense",
  "supplier_purchase",
  "supplier_payment",
  "inventory_consumption",
  "project_invoice",
] as const satisfies readonly JournalSourceType[];

export const INVESTING_SOURCE_TYPES = [
  "manual_adjustment",
] as const satisfies readonly JournalSourceType[];

export const FINANCE_TRANSACTION_TYPES = ["income", "expense"] as const;
export type FinanceTransactionType = (typeof FINANCE_TRANSACTION_TYPES)[number];
export const financeTransactionTypeSchema = z.enum(FINANCE_TRANSACTION_TYPES);
