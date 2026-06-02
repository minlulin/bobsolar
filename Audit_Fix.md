# Audit_Fix.md — BOB Solar Codebase Audit & Fix Plan

> **Generated:** 2026-05-31
> **Total Issues Found:** 46
> **Context:** Myanmar solar installation business — 3 shareholders (Author, Arkar, Yenyeinaung), MMK currency, double-entry accounting

---

## Executive Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 4 | 🔴 Immediate |
| HIGH | 12 | 🟠 This Sprint |
| MEDIUM | 19 | 🟡 Next Sprint |
| LOW | 11 | 🟢 Backlog |

---

## PHASE 1: CRITICAL FIXES (Do Immediately)

### C-1. Backup Files Stored with Public Access ( FIXED )
- **File:** `src/actions/backup-actions.ts:187-192`
- **Issue:** `access: "public"` on Vercel Blob upload. Anyone with the URL downloads the ENTIRE database including password hashes, financial records, and user data.
- **Fix:** Change to `access: "private"`. Create a download endpoint that checks admin auth before serving backup files.
- **Impact:** Data breach — password hashes, financial records exposed publicly.

### C-2. Owner Draw Action Hardcodes Owner A Accounts ( FIXED )
- **File:** `src/app/(dashboard)/owner-portal/actions.ts:149-164`
- **Issue:** `requestOwnerDrawAction` always uses `"owner_a_distributions_payable"` and `"owner_a_draws"` regardless of which owner requests the draw. Comment says "For demo purposes". Owner B and Owner C draws corrupt equity records.
- **Fix:** Use the existing `resolvePartnerAccounts(tx, ownerId)` from `src/lib/finance/equity.ts` to dynamically resolve the correct owner's accounts based on their DB owner ID.
- **Impact:** All non-Owner-A draws post to wrong ledger accounts. Financial statements are incorrect.

### C-3. Owner Portal Missing Per-Owner Authorization ( FIXED )
- **File:** `src/app/(dashboard)/owner-portal/actions.ts:134`
- **Issue:** `requestOwnerDrawAction` calls `requireAuth()` but never verifies `user.userId === owner.userId`. Any authenticated staff user can request a draw on behalf of any owner.
- **Fix:** After resolving the owner, verify that `auth.userId === owner.userId`. Restrict to owner's own account or require admin role for cross-owner operations.
- **Impact:** Any staff user can drain any owner's distribution balance.

### C-4. Local File Fallback Stores Uploads in Public Directory ( FIXED )
- **File:** `src/lib/storage/blob.ts:35-49`
- **Issue:** `writeLocalFallback` writes files to `public/` directory, making them directly accessible via HTTP. The `NODE_ENV` check on line 80 could be misconfigured.
- **Fix:** Add explicit `NODE_ENV !== 'production'` guard. Write to a non-public directory (e.g., `.uploads/`) even in dev, or serve via a route handler.

---

## PHASE 2: HIGH PRIORITY (This Sprint)

### H-1. Owner Portal Actions Bypass Error Handler ( FIXED )
- **File:** `src/app/(dashboard)/owner-portal/actions.ts:129-194`
- **Issue:** Both `requestOwnerDrawAction` and `payCapitalCallAction` have no try/catch. Raw errors propagate with internal details (stack traces, DB errors).
- **Fix:** Wrap in try/catch, use `handleActionError()`, return `ActionResponse<T>` with `successResponse()`.
- **Impact:** Internal error details leaked to client.

### H-2. Owner Portal Missing Cache Invalidation ( FIXED )
- **File:** `src/app/(dashboard)/owner-portal/actions.ts:129-194`
- **Issue:** Neither action calls `revalidatePath` or `revalidateTag`. Server component page data is stale after mutations.
- **Fix:** Add `revalidatePath("/owner-portal")` after successful mutations.
- **Impact:** Owner sees stale data after draws/capital calls.

### H-3. Owner Portal Missing Action Response Type ( FIXED )
- **File:** `src/app/(dashboard)/owner-portal/actions.ts:167, 193`
- **Issue:** Returns `{ success: true }` instead of `ActionResponse<T>`. Breaks consistent error handling pattern.
- **Fix:** Return `successResponse(data)` with proper typing.
- **Impact:** Inconsistent error handling across codebase.

### H-4. Sequential DB Queries in Owner Portal ( FIXED )
- **File:** `src/app/(dashboard)/owner-portal/actions.ts:24-107`
- **Issue:** 6+ sequential DB queries that could be parallelized. Queries 3-7 are independent.
- **Fix:** Use `Promise.all` for independent queries.
- **Impact:** Slow page load for owner portal.

### H-5. Finance Quick View Cache Tag Mismatch ( FIXED )
- **File:** `src/actions/dashboard-actions.ts:430` + `src/lib/cache-tags.ts`
- **Issue:** `getCachedFinanceQuickView` uses tag `"dashboard:finance"` but this tag doesn't exist in `CACHE_TAGS`. Never invalidated after mutations.
- **Fix:** Add `FINANCE_QUICK_VIEW: "dashboard:finance"` to `CACHE_TAGS` and call `revalidateTag()` in payment/expense mutations.
- **Impact:** Finance dashboard shows stale data.

### H-6. CSRF Protection Bypass on Upload ( FIXED )
- **File:** `src/app/api/upload/route.ts:136-160`
- **Issue:** If both `origin` and `referer` headers are absent, CSRF check is skipped entirely.
- **Fix:** Reject requests that have neither `origin` nor `referer` header.
- **Impact:** Potential CSRF attack vector.

### H-7. Unsafe `as` Casts in Expenses Action ( FIXED )
- **File:** `src/app/(dashboard)/finance/expenses/actions.ts:19, 70-77`
- **Issue:** Double-cast through `unknown` for Zod enum, and `formData.get("...") as string` without null checks.
- **Fix:** Use `[...OPERATING_EXPENSE_ACCOUNT_CODES]` for mutable copy. Add null checks for FormData.
- **Impact:** Runtime errors if fields are missing.

### H-8. Expenses Action Bypasses Standard Pattern ( FIXED )
- **File:** `src/app/(dashboard)/finance/expenses/actions.ts:27-101`
- **Issue:** `getExpensesData` and `submitGeneralExpense` return raw objects instead of `ActionResponse<T>`. No try/catch.
- **Fix:** Wrap in try/catch, use `handleActionError`, return `ActionResponse`.
- **Impact:** Inconsistent error handling.

### H-9. Unsafe Cast in Finance Expenses ( FIXED )
- **File:** `src/lib/finance/expenses.ts:38`
- **Issue:** `accountId: (...find...)?.id as string` — if account not found, casts `undefined` to `string`.
- **Fix:** Add null check before cast: `if (!account) throw new Error("Ledger account not found")`.
- **Impact:** FK constraint violation at DB level.

### H-10. Dashboard Stats Cache Staleness ( FIXED )
- **File:** `src/actions/dashboard-actions.ts:73-118`
- **Issue:** `unstable_cache` with 300s TTL serves stale dashboard data for up to 5 minutes.
- **Fix:** Reduce TTL to 60s, or use tag-based invalidation for real-time freshness.
- **Impact:** Dashboard shows outdated stats.

### H-11. Owner Draw Amount Not Validated Server-Side ( FIXED )
- **File:** `src/app/(dashboard)/owner-portal/actions.ts:140`
- **Issue:** `z.number().int().positive()` validates format but not business logic. Client has `max` but it's soft. Owner can draw more than `availableDraw`.
- **Fix:** Server-side validation: query current balance, verify `amount <= availableDraw` before processing.
- **Impact:** Owner can overdraw, creating negative distribution payable balance.

### H-12. Query Retry Function Too Broad ( FIXED )
- **File:** `src/lib/query-config.ts:20`
- **Issue:** `error.message.includes("4")` matches any error containing digit "4" (e.g., "4 items found", "Failed 4 times").
- **Fix:** Use `error.message.includes("401") || error.message.includes("403") || error.message.includes("404")`.
- **Impact:** Legitimate retries suppressed for errors containing "4".

---

## PHASE 3: MEDIUM PRIORITY (Next Sprint)

### M-1. No Domain SSoT for Owner Transaction Types/Statuses ( FIXED )
- **File:** `src/lib/db/schema.ts:161-175`
- **Issue:** `ownerTransactionTypeEnum` and `ownerTransactionStatusEnum` have no domain-level SSoT. Actions reference string literals directly.
- **Fix:** Create `src/lib/domain/owner-transaction.ts` with SSoT constants, type guards, and labels.

### M-2. Missing SSoT Drift Tests ( FIXED )
- **File:** `src/lib/domain/__tests__/ssot-drift.test.ts`
- **Issue:** Missing drift tests for `PROJECT_STATUSES`, `QUOTATION_STATUSES`, `INVENTORY_CATEGORIES`, `INVENTORY_UNITS`, `OWNER_TRANSACTION_TYPES/STATUSES`.
- **Fix:** Add drift tests for all remaining enum-backed domain constants.

### M-3. CACHE_TAGS Is Incomplete ( FIXED )
- **File:** `src/lib/cache-tags.ts`
- **Issue:** Only 4 tags defined. Missing: projects, customers, suppliers, purchases, warranty, finance reports, ledger.
- **Fix:** Extend `CACHE_TAGS` to cover all data domains.

### M-4. Owner Portal Has No Cache ( FIXED )
- **File:** `src/app/(dashboard)/owner-portal/page.tsx`
- **Issue:** Every page visit triggers 5+ DB queries with no caching.
- **Fix:** Add React `cache()` for request-level dedup.

### M-5. KV Cache (lib/cache.ts) Appears Unused ( FIXED )
- **File:** `src/lib/cache.ts`
- **Issue:** Defines a custom Redis/Upstash KV wrapper, but no features appear to use it.
- **Fix:** Deleted to reduce technical debt.

### M-6. useSuppliers Missing staleTime ( FIXED )
- **File:** `src/hooks/use-suppliers.ts:13`
- **Issue:** Hook defaults to `staleTime: 0`.
- **Fix:** Update to use `staleTime: STALE_TIME.MEDIUM` (1 minute).

### M-7. usePurchases Missing staleTime ( FIXED )
- **File:** `src/hooks/use-purchases.ts:18-27`
- **Issue:** No `staleTime` configured for list or detail queries.
- **Fix:** Add `staleTime: STALE_TIME.SHORT`.

### M-8. Sequential Queries in Payment Finance Summary ( FIXED )
- **File:** `src/actions/payment-actions.ts:337-355`
- **Issue:** `totalIncomingRow` and `totalOutgoingRow` fetched sequentially but independent.
- **Fix:** Used `Promise.all` to fetch queries concurrently.

### M-9. Missing Index for ownerTransactions.ownerId ( FIXED )
- **File:** `src/lib/db/schema.ts:799-810`
- **Issue:** No index on `ownerId` column. Owner portal queries with `groupBy(ownerId)` will degrade.
- **Fix:** Added `index("owner_transactions_owner_id_idx").on(table.ownerId)`.

### M-10. No Myanmar Tax Calculation Logic ( FIXED )
- **File:** `src/lib/validators/quotation.ts:36`
- **Issue:** Accepts arbitrary tax percent but has no Myanmar Commercial Tax rules, withholding tax helpers.
- **Fix:** Created `src/lib/domain/tax.ts` with Myanmar tax rules.

### M-11. Inconsistent MMK Currency Formatting ( FIXED )
- **Files:** Various across codebase
- **Issue:** No centralized `formatMMK()` utility. Some use `Intl.NumberFormat`, some hardcode "Ks".
- **Fix:** Create centralized utility in `src/lib/utils.ts`.

### M-12. Owner Portal Client Component Too Large
- **File:** `src/app/(dashboard)/owner-portal/client.tsx` (529 lines)
- **Issue:** Single file contains all UI including modals, tabs, forms, animations.
- **Fix:** Extract modals, animations, and tab content into separate components.

### M-13. Missing Dynamic Imports for Modals
- **File:** `src/app/(dashboard)/owner-portal/client.tsx`
- **Issue:** Dialog components always rendered in DOM (just hidden).
- **Fix:** Use `next/dynamic` for lazy-loaded modals.

### M-14. style jsx global in Owner Portal
- **File:** `src/app/(dashboard)/owner-portal/client.tsx:512-526`
- **Issue:** Uses `<style jsx global>` for scrollbar styles. Adds runtime CSS-in-JS overhead.
- **Fix:** Move to global CSS or Tailwind config.

### M-15. deleteBackup Accepts Arbitrary URLs
- **File:** `src/actions/backup-actions.ts:241-252`
- **Issue:** Accepts any URL string. Malicious admin could delete non-backup blobs.
- **Fix:** Validate URL starts with expected backup folder path.

### M-16. Session Secret Not Validated at Startup
- **File:** `src/lib/auth/session.ts:20-24`
- **Issue:** `assertSessionSecretAtStartup` only runs in production. Missing secret causes runtime crashes.
- **Fix:** Validate in development too (warn), always validate in production.

### M-17. No Domain SSoT for Owner Transaction Types
- **File:** `src/lib/db/schema.ts:161-175`
- **Issue:** `ownerTransactionTypeEnum` values used as string literals in actions/equity.ts.
- **Fix:** Create domain constants and use them everywhere.

### M-18. Owner Portal Uses Hardcoded "Ks" Prefix
- **File:** `src/app/(dashboard)/owner-portal/client.tsx:404`
- **Issue:** Hardcoded "Ks" prefix for MMK. Other parts of app may format differently.
- **Fix:** Use centralized currency formatter.

### M-19. No Myanmar Public Holidays for Scheduling
- **Issue:** No awareness of Thingyan, Independence Day, etc. for project timelines.
- **Fix:** Create `src/lib/domain/myanmar-holidays.ts` (low priority).

---

## PHASE 4: LOW PRIORITY (Backlog)

### L-1. Duplicate Owner Transaction Status Type Names
- **File:** `src/lib/db/schema.ts:161-175`
- **Issue:** Naming inconsistency: `capital_call` vs `capital_call_issued`.
- **Fix:** Standardize naming conventions.

### L-2. Test Files Use Extensive `as any`
- **Files:** Various test files
- **Issue:** ~14 instances of `any` type across test files.
- **Fix:** Gradually improve test type-safety.

### L-3. `as Record<string, unknown>` in Partners.ts
- **File:** `src/lib/domain/partners.ts:74`
- **Issue:** Manual type assertion instead of Zod parsing.
- **Fix:** Use Zod to parse `SEED_PARTNERS` JSON.

### L-4. Unnecessary `as string | null` Casts
- **File:** `src/lib/finance/metrics.ts:22,27,32,37`
- **Issue:** `null as string | null` — unnecessary cast.
- **Fix:** Remove unnecessary casts.

### L-5. DB Singleton Uses Proxy
- **File:** `src/lib/db/index.ts:34-38`
- **Issue:** Proxy pattern is unnecessary technical debt.
- **Fix:** Remove Proxy, update imports to use `getDb()` directly.

### L-6. Missing optimizePackageImports for Some Packages
- **File:** `next.config.mjs:70`
- **Issue:** Missing `@tanstack/react-query` and `motion/react`.
- **Fix:** Add to `optimizePackageImports`.

### L-7. useCheckProjectCompletionOutstanding Not Using Factory
- **File:** `src/hooks/use-projects.ts:172-176`
- **Issue:** Manually creates mutation instead of using `createMutationHook`.
- **Fix:** Migrate to mutation factory pattern.

### L-8. useGenerateVoucher Not Using Factory
- **File:** `src/hooks/use-vouchers.ts:23-49`
- **Issue:** Manually creates mutation instead of using `createMutationHook`.
- **Fix:** Migrate to mutation factory pattern.

### L-9. N+1 Pattern in getProjects Warranty Summary
- **File:** `src/actions/project-actions.ts:571-593`
- **Issue:** In-memory grouping could be moved to SQL at scale.
- **Fix:** Consider SQL-based aggregation if performance degrades.

### L-10. Inconsistent Search Escaping
- **File:** `src/actions/customer-actions.ts:68-73`
- **Issue:** Search escaping is good but could be centralized.
- **Fix:** Create shared `escapeSearchTerm()` utility.

### L-11. Missing `revalidatePath` for Some Finance Actions
- **Files:** Various finance actions
- **Issue:** Some finance actions don't call `revalidatePath` for dashboard.
- **Fix:** Audit all finance mutations for proper cache invalidation.

---

## Implementation Plan

### Week 1: Critical Fixes
| Task | File(s) | Est. Hours |
|------|---------|------------|
| Fix backup access to private | `backup-actions.ts` | 2 |
| Fix owner draw to use resolvePartnerAccounts | `owner-portal/actions.ts` | 3 |
| Add per-owner authorization | `owner-portal/actions.ts` | 2 |
| Fix local fallback directory | `blob.ts` | 1 |

### Week 2: High Priority
| Task | File(s) | Est. Hours |
|------|---------|------------|
| Add error handling to owner portal | `owner-portal/actions.ts` | 2 |
| Add cache invalidation to owner portal | `owner-portal/actions.ts` | 1 |
| Fix finance cache tag mismatch | `dashboard-actions.ts`, `cache-tags.ts` | 1 |
| Fix CSRF bypass on upload | `upload/route.ts` | 1 |
| Fix unsafe casts in expenses | `expenses/actions.ts`, `expenses.ts` | 2 |
| Fix query retry function | `query-config.ts` | 0.5 |
| Parallelize owner portal queries | `owner-portal/actions.ts` | 1 |

### Week 3: Medium Priority
| Task | File(s) | Est. Hours |
|------|---------|------------|
| Create owner-transaction domain SSoT | New file | 2 |
| Extend CACHE_TAGS | `cache-tags.ts` | 1 |
| Add staleTime to suppliers/purchases hooks | `use-suppliers.ts`, `use-purchases.ts` | 0.5 |
| Add ownerTransactions index | `schema.ts` | 0.5 |
| Create Myanmar tax domain | New file | 3 |
| Create centralized formatMMK | `utils.ts` | 1 |
| Refactor owner portal client | `owner-portal/client.tsx` | 3 |

### Week 4: Low Priority + Cleanup
| Task | File(s) | Est. Hours |
|------|---------|------------|
| Remove dead KV cache | `cache.ts` | 0.5 |
| Add missing drift tests | `ssot-drift.test.ts` | 2 |
| Fix partner env parsing with Zod | `partners.ts` | 1 |
| Remove DB Proxy pattern | `db/index.ts` | 1 |
| Migrate hooks to mutation factory | `use-projects.ts`, `use-vouchers.ts` | 1 |

---

## Myanmar Business Context Notes

1. **Currency:** All amounts must be integer MMK (no decimals). The `Math.round()` usage is correct.
2. **Tax:** Commercial Tax is 5% for most goods/services. Withholding Tax is 2% (residents) / 2.5% (non-residents).
3. **Payment Methods:** KBZ, AYA, CB, Wave Pay are Myanmar-specific. The domain presets are correct.
4. **Shareholders:** 3 partners (Author, Arkar, Yenyeinaung) with ~33.33% each. The slot-based account system (A/B/C) is correct but must be dynamically resolved.
5. **Session:** 30-day TTL is appropriate for Myanmar's typically lower-bandwidth connections.

---

## Verification Checklist

After each phase, run:
```bash
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run build
```

For owner portal changes, manually test:
- [ ] Owner A can only draw from Owner A's balance
- [ ] Owner B can only draw from Owner B's balance
- [ ] Owner C can only draw from Owner C's balance
- [ ] Draws post to correct ledger accounts per owner
- [ ] Capital calls resolve to correct owner accounts
- [ ] Error messages are user-friendly (no internal details)
- [ ] Dashboard reflects changes immediately after mutations
