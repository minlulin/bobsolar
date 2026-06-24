/**
 * Query Configuration SSoT
 * Centralized stale times, retry policies, and refetch strategies.
 */

/** Stale time tiers — how fresh data must be before refetching */
export const STALE_TIME = {
  /** Real-time data: notifications, unread counts */
  REALTIME: 15_000,
  /** User-facing lists and detail pages */
  SHORT: 30_000,
  /** Dashboard aggregates, summary stats */
  MEDIUM: 60_000,
  /** Reference data: payment methods, ledger accounts, settings */
  LONG: 5 * 60_000,
} as const;
