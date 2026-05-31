import type { QueryKey } from "@tanstack/react-query";

/**
 * Mutation metadata for automatic query invalidation.
 *
 * Attach `meta.invalidates` to any mutation. The MutationCache `onSuccess`
 * handler reads this and invalidates the listed query keys automatically.
 *
 * This avoids manual `queryClient.invalidateQueries()` calls in every
 * mutation's `onSuccess` callback.
 *
 * NOTE: We cannot use TanStack Query's `MutationMeta` module augmentation
 * because TypeScript 6.0's strict duplicate identifier check rejects it.
 * Instead, we attach this as `meta` (which TanStack Query types as
 * `Record<string, unknown>`) and cast in the MutationCache handler.
 */
export interface SolarMutationMeta {
  /** Query key prefixes to invalidate on mutation success. */
  invalidates?: QueryKey[];
}

/**
 * Extract SolarMutationMeta from a mutation's `meta` property.
 * Returns undefined if meta is not a SolarMutationMeta.
 */
export function extractMutationMeta(meta: unknown): SolarMutationMeta | undefined {
  if (
    meta !== null &&
    meta !== undefined &&
    typeof meta === "object" &&
    "invalidates" in meta &&
    Array.isArray((meta as SolarMutationMeta).invalidates)
  ) {
    return meta as SolarMutationMeta;
  }
  return undefined;
}
