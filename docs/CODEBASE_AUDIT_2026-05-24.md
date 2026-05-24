# Codebase Audit Report
**Date:** 2026-05-24
**Auditor:** AI Senior Staff Engineer

## 1. Executive Summary
- Total findings: 6 (Critical: 0, High: 2, Medium: 3, Low: 1)
- Key themes:
  - Type-safety erosion around React Query hooks is forcing runtime casts and masking integration drift.
  - Inventory UX has an error-path bug that can show a false “No items found” state when the backend fails.
  - Mutation/cache orchestration has weak observability and inefficient bulk-write behaviour.

Most risky area: `inventory` data flow spanning `src/actions`, `src/hooks`, and `src/app/(dashboard)/inventory` due to loose contracts and missing error UI.

## 2. Detailed Findings

### AUD-001 – Code Quality & Consistency (SSoT) – High
**File(s):** `src/hooks/use-inventory.ts:15-37`, `src/app/(dashboard)/inventory/page-client.tsx:34-41`

**Description:** `useInventoryItems` and `useInventoryItem` return unparameterized `UseQueryResult`, which defaults data to `unknown`. The consumer in `page-client.tsx` then compensates by force-casting `rawResponse` to a local `PaginatedItems` type.

```ts
// use-inventory.ts
export function useInventoryItems(filters: InventoryFilter = {}): UseQueryResult {

// page-client.tsx
const response = rawResponse as PaginatedItems | undefined;
```

**Impact:**
- Breaks SSoT for response shape (hook contract vs local component type).
- Allows silent drift if action return shape changes.
- Raises runtime failure probability (e.g., undefined fields used as if present).

**Root Cause:** Hook-level typing was left generic/implicit, pushing shape responsibility to each consumer.

**Recommended Fix:**
1. Export canonical response type once (e.g., `InventoryListResponse`) from `inventory-actions` or a shared domain type module.
2. Type hooks explicitly:
   - `UseQueryResult<InventoryListResponse, Error>` for list.
   - `UseQueryResult<InventoryItem, Error>` for detail.
3. Remove local cast and use strongly-typed `data` directly.
4. Add compile-time assertion tests for contract stability.

---

### AUD-002 – Routing & Data Fetching – High
**File(s):** `src/app/(dashboard)/inventory/page-client.tsx:105-138`, `src/hooks/use-inventory.ts:18-21`

**Description:** The query function throws on failure (`throw new Error(res.error)`), but the page client does not branch on `isError`/`error`. Non-loading error states fall through to the empty-state branch.

**Impact:**
- Users see “No items found” during server/network failure.
- Operational incidents are hidden as normal UX states.
- Support/debugging becomes harder due to incorrect symptom presentation.

**Root Cause:** Happy-path + empty-path handled; error-path omitted at component level.

**Recommended Fix:**
1. Read `isError` and `error` from `useInventoryItems`.
2. Render a dedicated error panel with retry action (`refetch`) before empty-state branch.
3. Align with route-level `error.tsx` behaviour and centralized error component pattern.

---

### AUD-003 – UI/UX Integrity – Low
**File(s):** `src/app/(dashboard)/inventory/page-client.tsx:125`

**Description:** UI copy contains HTML entity text `&lsquo;` directly in JSX string (`We couldn&lsquo;t...`) instead of a normal apostrophe.

**Impact:**
- User-visible typography defect.
- Signals inconsistent content handling and weak UI QA around empty states.

**Root Cause:** Incorrect entity insertion in a plain text JSX literal.

**Recommended Fix:**
- Replace with standard apostrophe: `We couldn't find...`.
- Add lint/content check for escaped entity artifacts in JSX text nodes.

---

### AUD-004 – Performance (DB) – Medium
**File(s):** `src/actions/inventory-actions.ts:230-240`

**Description:** `bulkUpdatePrices` performs one `UPDATE` statement per item inside a loop.

**Impact:**
- Linear query count growth (`N` items -> `N` round trips/executes).
- Slower bulk operations and increased lock time under load.

**Root Cause:** Row-by-row mutation implementation instead of set-based SQL update.

**Recommended Fix:**
1. Replace loop with a single set-based update using `CASE WHEN` or `FROM (VALUES ...)` join pattern.
2. Keep transaction, but reduce statement count to 1.
3. Add benchmark test for 100/500-row batches to prevent regressions.

---

### AUD-005 – Business Logic & Runtime Robustness – Medium
**File(s):** `src/hooks/mutation-factory.ts:71-73`

**Description:** Query invalidation failures are swallowed with empty `.catch(() => {})`.

**Impact:**
- Stale UI can persist without telemetry.
- Hard to diagnose cache coherency bugs after successful mutation toasts.

**Root Cause:** Error suppression without logging, retry, or fallback re-fetch.

**Recommended Fix:**
1. Replace empty catch with structured logging (`console.error` in dev, telemetry in prod).
2. Optionally trigger targeted fallback `refetchQueries` or surface warning toast when invalidation fails.
3. Add unit test asserting invalidation errors are observable.

---

### AUD-006 – TypeScript Escape Hatch / Runtime Robustness – Medium
**File(s):** `src/hooks/mutation-factory.ts:113-116`

**Description:** `createQueryHook` returns `res.data as TData` after success check, even though `data` is optional in type (`data?: TData`).

**Impact:**
- `undefined` can be injected into `UseQueryResult<TData>` at runtime.
- Consumers may dereference fields assuming non-null `TData`, causing crashes.

**Root Cause:** Generic cast bypasses the optionality contract in action response type.

**Recommended Fix:**
1. Enforce non-optional `data` on successful response in shared action response type, or
2. Guard explicitly:
   - `if (res.data === undefined) throw new Error("Missing data in successful response")`.
3. Remove force-cast and let TS infer validated non-undefined return.

## 3. Systemic Issues & Patterns
- **Contract drift between actions/hooks/components:** repeated pattern where consumers reconstruct types locally instead of importing canonical contracts.
  - **Systemic fix:** Introduce per-domain `Result` types (e.g., `InventoryListResult`) in a single domain module; enforce via lint rule forbidding local shadow response types in route clients.
- **Error states underrepresented in client surfaces:** empty and loading states are implemented, but error-state handling is inconsistent.
  - **Systemic fix:** Standardize tri-state view helper (`loading/error/empty/data`) and require it in all dashboard list pages.
- **Silent failure handling in cache/mutation infra:** infrastructure code hides failures.
  - **Systemic fix:** define mutation observability policy (log + toast strategy), plus CI test for cache invalidation failures.

## 4. Appendix: Audit Log
- **Modules audited:**
  - `src/app/(dashboard)/inventory/page-client.tsx`
  - `src/hooks/use-inventory.ts`
  - `src/hooks/mutation-factory.ts`
  - `src/actions/inventory-actions.ts`
  - `package.json` (tooling/strictness context)
- **Migration/history spot-check:** `drizzle/migrations/*` inventory-related migration presence verified during repository traversal.
- **Automated checks run:**
  - `pnpm -s typecheck` (pass)
  - `pnpm -s biome:check` (pass)
- **Files skipped:** No binary/runtime-generated files were audited for logic (`public/*` assets excluded from logic review).
- **Tools simulated:** Strict TypeScript contract analysis, React Query runtime-path reasoning, server action cache invalidation path review, and DB mutation complexity review.
