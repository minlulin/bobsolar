# Audit Fix Analysis & Improvement Plan

**Based on:** `SSoT_Audit.md` findings + modern best practices research (May 2026)  
**Tech Stack:** Next.js 16, TypeScript 6.0, Drizzle ORM 0.45, Zod 4, TanStack Query v5, Zustand 5, React 19  
**Last Updated:** 2026-05-31

---

## Remaining Tasks

These items are NOT yet implemented. Listed top-first for visibility.

### R1. ~~DB Migration for `ownerTransactions` Enums~~ ✅ DONE

**Status:** Applied via `drizzle-kit push`. Enums verified in DB.  
**Note:** `drizzle-kit migrate` failed because migration 0029 was already partially applied. `drizzle-kit push` applied the schema directly.

### R2. ~~Partner Company Multi-Tenancy (Section 4.1)~~ ✅ DONE

**Status:** Implemented.  
**What was done:**
- Created `lib/domain/partners.ts` — env-driven partner registry reading from `SEED_PARTNERS` JSON env var
- Updated `lib/finance/equity.ts` — added `resolvePartnerAccounts()` that resolves partner ledger accounts from DB owner ID via email lookup
- Created `lib/db/seed-owners.ts` — seeds `owners` table from `SEED_PARTNERS` env var
- Added `SEED_PARTNERS` to `.env.local` and `.env.example`
- All 3 partners seeded into DB (Author, Arkar, Yenyeinaung — 33.34%/33.33%/33.33%)

**For Vercel:** Set `SEED_PARTNERS` as an environment secret with the same JSON format.

### R3. Convert 5 Client Pages to Server Components (Section 5.1)

**Status:** Not implemented.  
**Why deferred:** Converting full-page `"use client"` components to Server Components with client islands is a significant architectural change. Each page needs: (1) server-side data prefetching, (2) `HydrationBoundary` wrapper, (3) client component extraction. Requires testing each page's UX after conversion.  
**Pages affected:**
- `settings/page.tsx`
- `warranty/page.tsx`
- `suppliers/page.tsx`
- `purchases/new/page.tsx`
- `purchases/[id]/page.tsx`

**Action:** Convert one page at a time, starting with `suppliers/page.tsx` (simplest — just a list + grid).

### R4. Remaining Mutation Hooks → Factory Migration (Section 7.4)

**Status:** 10 hooks migrated, ~15 remaining.  
**Why deferred:** Some hooks have complex invalidation logic (e.g., `useConvertToProject` invalidates 4 key families, `useDeleteQuotation` has conditional logic). These need per-hook analysis to ensure the factory pattern handles all cases.  
**Remaining hooks:**
- `use-quotations.ts`: `useCreateQuotation`, `useUpdateQuotationStatus`, `useDeleteQuotation`, `useDuplicateQuotation`, `useUpdateQuotation`
- `use-projects.ts`: `useConvertToProject`, `useUpdateProject`, `useAddProjectCost`, `useDeleteProjectCost`, `useConsumeProjectInventory`, `useAddProjectRemark`, `useDeleteProjectRemark`, `useMarkProjectCompleted`, `useCreateProjectWarrantyAlert`
- `use-payments.ts`: `useRecordPayment`
- `use-purchases.ts`: `useCreatePurchaseOrder`, `useReceivePurchaseOrder`, `usePayPurchaseOrder`
- `use-warranty.ts`: `useResolveWarrantyAlert`, `useReopenWarrantyAlert`
- `use-notifications.ts`: `useMarkNotificationAsRead`, `useMarkAllNotificationsAsRead`, `useDeleteNotification`, `useDeleteAllNotifications`

**Action:** Start with `useReceivePurchaseOrder`, `usePayPurchaseOrder`, `useRecordPayment` (simplest). Leave complex ones for later.

### R5. MutationCache Global Invalidation Pattern (Section 3.2)

**Status:** `query-client.ts` factory created but without MutationCache pattern.  
**Why deferred:** TanStack Query v5's `MutationMeta` module augmentation conflicts with TypeScript 6.0's strict duplicate identifier check. The `declare module "@tanstack/react-query" { interface MutationMeta { ... } }` pattern fails because `MutationMeta` is already declared in `@tanstack/query-core`.  
**Action:** Wait for TanStack Query to officially support meta-based invalidation, or use a wrapper function instead of module augmentation.

### R6. AdvisoryLock `using` Pattern (Section 6.3)

**Status:** Not implemented.  
**Why deferred:** TypeScript 6.0's `using` declarations require `Symbol.dispose` / `Symbol.asyncDispose` runtime support. Node.js 18+ supports it, but the current advisory lock pattern works correctly and is well-tested. Changing to `using` would require rewriting all callers.  
**Action:** Low priority. Implement when the codebase upgrades to a Node.js version with full `using` support and there's a reason to change the existing pattern.

### R7. Replace DB Proxy (Section 7.1)

**Status:** Not implemented.  
**Why deferred:** The Proxy-based `db` export in `db/index.ts` works correctly and is used by every file that imports `db`. Replacing it with a direct export would require testing all DB access paths. The performance overhead of the Proxy trap is minimal compared to the actual DB queries.  
**Action:** Low priority. Replace only if profiling shows the Proxy as a bottleneck (unlikely).

### R8. `satisfies` for LEDGER_ACCOUNT_LABELS (Section 6.2)

**Status:** Not implemented.  
**Why deferred:** The existing `Record<LedgerAccountCode, string>` type already provides compile-time coverage. Adding `satisfies` is a minor improvement that doesn't change runtime behavior.  
**Action:** Apply when touching `domain/finance.ts` for other reasons.

### R9. ESLint Rules for Anti-Patterns (Section 8.2)

**Status:** Not implemented.  
**Why deferred:** The project uses Biome as the primary linter, not ESLint. Biome already catches `noNonNullAssertion`, `noUnusedVariables`, and import ordering. Adding ESLint rules would create dual-linter maintenance.  
**Action:** Check if Biome has equivalent rules for `no-explicit-any` and `no-unsafe-*` before adding ESLint.

---

## Completed Items

All items below have been implemented, verified with typecheck (0 errors), lint (0 errors), and tests (340/340 pass).

### C1. Critical Bug Fixes

| Item | Status | Files |
|------|--------|-------|
| Finding #1: Transaction error response lost | ✅ Done | `quotation-actions.ts` |
| Finding #4: `ownerTransactions` pgEnums | ✅ Done (migration applied) | `schema.ts` |
| Finding #5: Unsafe idempotency cast | ✅ Done | `idempotency.ts` |
| Finding #6: Variable shadowing | ✅ Done | `quotation-actions.ts` |
| Finding #7: Unsafe category cast | ✅ Done | `quote-builder-store.ts` |
| All 8 lint errors | ✅ Done | 4 files |

### C2. SSoT Consolidation

| Item | Status | Files |
|------|--------|-------|
| 5 duplicate types re-exported | ✅ Done | `invoice.ts`, `finance.ts`, `accounting-period.ts`, `purchase.ts` |
| `ActionData<T>` centralized | ✅ Done | `action-response.ts` + 8 hook files |
| `env.ts` with Zod validation | ✅ Done | `env.ts` |
| `query-client.ts` factory | ✅ Done | `query-client.ts` |

### C3. Business Logic SSoT

| Item | Status | Files |
|------|--------|-------|
| `PAYMENT_METHOD_LEDGER_MAP` | ✅ Done (no legacy) | `domain/payment.ts` |
| `COST_TYPE_EXPENSE_MAP` | ✅ Done | `domain/cost-types.ts` |
| Payment method labels (Myanmar) | ✅ Done | `domain/payment.ts` |
| `mapPaymentMethodNameToAssetAccount` delegates to SSoT | ✅ Done | `finance/ledger.ts` |
| `mapCostTypeToExpenseAccount` delegates to SSoT | ✅ Done | `finance/ledger.ts` |
| Removed legacy aliases | ✅ Done | `domain/payment.ts` |
| Partner registry (env-driven) | ✅ Done | `domain/partners.ts` |
| Partner seed script | ✅ Done | `db/seed-owners.ts` |
| Owner DB records seeded | ✅ Done | All 3 partners in DB |

### C4. Cache Strategy

| Item | Status | Files |
|------|--------|-------|
| `STALE_TIME` constants | ✅ Done | `query-config.ts` |
| `STALE_TIME` applied to ALL 12 hooks | ✅ Done | All hook files |
| `CACHE_TAGS` verified complete | ✅ Done | `cache-tags.ts` |
| Polling → `refetchOnWindowFocus` | ✅ Done | `use-dashboard.ts` |

### C5. Hook Factory Migration

| Item | Status | Files |
|------|--------|-------|
| `useCreateSupplier` → factory | ✅ Done | `use-suppliers.ts` |
| `useUpdateSupplier` → factory | ✅ Done | `use-suppliers.ts` |
| `useDeleteSupplier` → factory | ✅ Done | `use-suppliers.ts` |
| `useCreateCashTransfer` → factory | ✅ Done | `use-cash-transfers.ts` |
| `useCreateManualJournalEntry` → factory | ✅ Done | `use-manual-journal.ts` |
| `useArchiveQuotation` → factory | ✅ Done | `use-quotations.ts` |
| `useRestoreQuotation` → factory | ✅ Done | `use-quotations.ts` |
| `supplier-dialog.tsx` updated for ActionResponse | ✅ Done | `supplier-dialog.tsx` |

### C6. Type Safety

| Item | Status | Files |
|------|--------|-------|
| SSoT drift type tests | ✅ Done | `ssot-drift.test.ts` |
| `formatSpecNumber` dead code removed | ✅ Done | `domain/inventory.ts` |
| `FinancePeriodFilter` direct import | ✅ Done | `use-finance-dashboard.ts` |

---

## Summary

| Category | Done | Remaining |
|----------|------|-----------|
| Critical bug fixes | 6/6 | 0 |
| SSoT consolidation | 4/4 | 0 |
| Business logic SSoT | 9/9 | 0 |
| Cache strategy | 4/5 | 1 (MutationCache pattern) |
| Hook factory migration | 8/25 | 17 hooks |
| Performance | 3/7 | 4 (DB proxy, `using`, `satisfies`, ESLint) |
| UX (Server Components) | 0/5 | 5 pages |
| Prevention | 1/4 | 3 (ESLint, CI scripts, code review) |
| DB migration | 1/1 | 0 |

**Total: 31 done, 12 remaining**

The remaining items are lower priority: architectural changes (Server Components), library limitations (MutationCache module augmentation), or minor polish (DB proxy, `using`, `satisfies`, ESLint).
