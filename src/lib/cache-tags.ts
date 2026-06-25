/**
 * Cache Tags SSoT
 * All revalidateTag strings used across the codebase.
 * Import from here instead of hardcoding tag strings.
 */

export const CACHE_TAGS = {
  QUOTATIONS_LIST: "quotations:list",
  INVENTORY_LIST: "inventory:list",
  DASHBOARD_STATS: "dashboard:stats",
  DASHBOARD_FINANCE: "dashboard:finance",
  SETTINGS_COMPANY: "settings:company",
  PROJECTS_LIST: "projects:list",
  CUSTOMERS_LIST: "customers:list",
  SUPPLIERS_LIST: "suppliers:list",
  PURCHASES_LIST: "purchases:list",
  WARRANTY_LIST: "warranty:list",
  FINANCE_REPORTS: "finance:reports",
  LEDGER: "ledger:entries",
  OWNER_PORTAL: "owner:portal",
  FINANCE: "finance",
} as const;
