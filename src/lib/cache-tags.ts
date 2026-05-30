/**
 * Cache Tags SSoT
 * All revalidateTag strings used across the codebase.
 * Import from here instead of hardcoding tag strings.
 */

export const CACHE_TAGS = {
  QUOTATIONS_LIST: "quotations:list",
  INVENTORY_LIST: "inventory:list",
  DASHBOARD_STATS: "dashboard:stats",
  SETTINGS_COMPANY: "settings:company",
} as const;
