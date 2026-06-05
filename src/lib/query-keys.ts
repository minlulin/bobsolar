import type { FinancePeriodFilter } from "@/lib/validators/finance";
import { type InventoryFilter, inventoryFilterSchema } from "@/lib/validators/inventory";
import type { LedgerFilter } from "@/lib/validators/ledger";
import type { ProjectListFilter } from "@/lib/validators/project";
import { type QuotationFilterInput, quotationFilterSchema } from "@/lib/validators/quotation";

function normalizeOptionalString(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeQuotationFilters(
  filters: QuotationFilterInput = {},
): Required<QuotationFilterInput> {
  const parsed = quotationFilterSchema.parse(filters);
  return {
    status: parsed.status ?? null,
    customerId: parsed.customerId ?? null,
    search: normalizeOptionalString(parsed.search),
    isArchived: parsed.isArchived ?? null,
    page: parsed.page,
    limit: parsed.limit,
  };
}

export function normalizeInventoryFilters(
  filters: InventoryFilter = {},
): Required<InventoryFilter> {
  const parsed = inventoryFilterSchema.parse(filters);
  return {
    category: parsed.category ?? null,
    search: normalizeOptionalString(parsed.search),
    isActive: parsed.isActive ?? null,
    page: parsed.page,
    limit: parsed.limit,
  };
}

export function normalizeLedgerFilters(filters: LedgerFilter = {}): LedgerFilter {
  return {
    dateFrom: filters.dateFrom ?? undefined,
    dateTo: filters.dateTo ?? undefined,
    accountCode: filters.accountCode ?? undefined,
    projectId: filters.projectId ?? undefined,
    sourceType: filters.sourceType ?? undefined,
    page: filters.page ?? 1,
    limit: filters.limit ?? 50,
  };
}

export type BudgetVarianceFilter = {
  periodStart?: string;
  periodEnd?: string;
};

export type BalanceSheetFilter = {
  dateAsOf?: string;
};

export type CashFlowFilter = {
  dateFrom?: string;
  dateTo?: string;
};

export function normalizeBudgetVarianceFilters(
  filters: BudgetVarianceFilter = {},
): Required<BudgetVarianceFilter> {
  return {
    periodStart: filters.periodStart ?? "",
    periodEnd: filters.periodEnd ?? "",
  };
}

export function normalizeBalanceSheetFilters(
  filters: BalanceSheetFilter = {},
): Required<BalanceSheetFilter> {
  return {
    dateAsOf: filters.dateAsOf ?? "",
  };
}

export function normalizeCashFlowFilters(filters: CashFlowFilter = {}): Required<CashFlowFilter> {
  return {
    dateFrom: filters.dateFrom ?? "",
    dateTo: filters.dateTo ?? "",
  };
}

export const quotationKeys = {
  all: ["quotations"] as const,
  list: (filters: QuotationFilterInput = {}) =>
    [...quotationKeys.all, "list", normalizeQuotationFilters(filters)] as const,
  detail: (id: string) => [...quotationKeys.all, "detail", id] as const,
};

export const inventoryKeys = {
  all: ["inventory"] as const,
  list: (filters: InventoryFilter = {}) =>
    [...inventoryKeys.all, "list", normalizeInventoryFilters(filters)] as const,
  detail: (id: string) => [...inventoryKeys.all, "detail", id] as const,
  search: (search: string) => [...inventoryKeys.all, "search", search] as const,
};

export const projectKeys = {
  all: ["projects"] as const,
  list: (filters: ProjectListFilter) => [...projectKeys.all, "list", filters] as const,
  detail: (id: string) => [...projectKeys.all, "detail", id] as const,
};

export const dashboardKeys = {
  all: ["dashboard"] as const,
  stats: () => [...dashboardKeys.all, "stats"] as const,
  pipeline: () => [...dashboardKeys.all, "pipeline"] as const,
  activity: (limit: number) => [...dashboardKeys.all, "activity", limit] as const,
  alerts: (limit: number) => [...dashboardKeys.all, "alerts", limit] as const,
  financeQuickView: () => [...dashboardKeys.all, "finance-quick-view"] as const,
};

export const warrantyKeys = {
  all: ["warranty"] as const,
  summary: () => [...warrantyKeys.all, "summary"] as const,
  list: (tab?: string) => [...warrantyKeys.all, "list", ...(tab ? [tab] : [])] as const,
};

export const ledgerKeys = {
  all: ["ledger"] as const,
  entries: (filters: LedgerFilter = {}) =>
    [...ledgerKeys.all, "entries", normalizeLedgerFilters(filters)] as const,
  balances: (filters: LedgerFilter = {}) =>
    [...ledgerKeys.all, "balances", normalizeLedgerFilters(filters)] as const,
  projects: () => [...ledgerKeys.all, "projects"] as const,
};

export const financeKeys = {
  all: ["finance"] as const,
};

export const financeDashboardKeys = {
  all: ["finance-dashboard"] as const,
  summary: (filters: FinancePeriodFilter) =>
    [...financeDashboardKeys.all, "summary", filters] as const,
  trend: (filters: FinancePeriodFilter) => [...financeDashboardKeys.all, "trend", filters] as const,
  breakdown: (filters: FinancePeriodFilter) =>
    [...financeDashboardKeys.all, "breakdown", filters] as const,
  risk: () => [...financeDashboardKeys.all, "risk"] as const,
  consistency: () => [...financeDashboardKeys.all, "consistency"] as const,
};

export const customerKeys = {
  all: ["customers"] as const,
  list: (filters?: Record<string, unknown>) =>
    [...customerKeys.all, "list", filters ?? {}] as const,
  detail: (id: string) => [...customerKeys.all, "detail", id] as const,
  search: (query: string) => [...customerKeys.all, "search", query] as const,
};

export const supplierKeys = {
  all: ["suppliers"] as const,
  list: () => [...supplierKeys.all, "list"] as const,
  detail: (id: string) => [...supplierKeys.all, "detail", id] as const,
};

export const purchaseKeys = {
  all: ["purchases"] as const,
  list: () => [...purchaseKeys.all, "list"] as const,
  detail: (id: string) => [...purchaseKeys.all, "detail", id] as const,
};

export const notificationKeys = {
  all: ["notifications"] as const,
  list: () => [...notificationKeys.all, "list"] as const,
  unread: () => [...notificationKeys.all, "unread"] as const,
};

export const settingsKeys = {
  all: ["settings"] as const,
  company: () => [...settingsKeys.all, "company"] as const,
  users: () => [...settingsKeys.all, "users"] as const,
  backups: () => [...settingsKeys.all, "backups"] as const,
};

export const manualJournalKeys = {
  all: ["manual-journal"] as const,
  accounts: () => [...manualJournalKeys.all, "accounts"] as const,
  projects: () => [...manualJournalKeys.all, "projects"] as const,
};

export const reportKeys = {
  all: ["reports"] as const,
  trialBalance: (date: string) => [...reportKeys.all, "trial-balance", date] as const,
  balanceSheet: (filters: BalanceSheetFilter = {}) =>
    [...reportKeys.all, "balance-sheet", normalizeBalanceSheetFilters(filters)] as const,
  budgetVariance: (filters: BudgetVarianceFilter = {}) =>
    [...reportKeys.all, "budget-variance", normalizeBudgetVarianceFilters(filters)] as const,
  cashFlow: (filters: CashFlowFilter = {}) =>
    [...reportKeys.all, "cash-flow", normalizeCashFlowFilters(filters)] as const,
};
