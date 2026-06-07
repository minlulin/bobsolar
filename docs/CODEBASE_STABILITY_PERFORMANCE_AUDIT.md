# BobSolar Codebase Stability and Performance Audit

Date: 2026-06-06

Scope: full Next.js application scan with emphasis on finance correctness, data integrity, cache behavior, dependency posture, security exposure, and performance. This report is an implementation plan only; it does not expand product scope.

Related skills applied: TypeScript modern rules, Neon/Postgres, frontend design, code-pattern guidance.

## Executive Summary

The codebase is already using a modern stack: Next.js 16, React 19, Tailwind 4, Drizzle ORM, Neon serverless, TanStack Query 5, Vitest 4, Playwright, Biome, and TypeScript 6. The highest-risk gaps are not framework age; they are consistency and integrity issues around financial writes, stale cache invalidation, backup completeness, public error leakage, service-worker caching of authenticated Next data, and a few business/math mismatches in finance reports.

The recommended path is to stabilize first, then upgrade patch/minor dependencies in a controlled batch. Do not start with feature work or broad refactors. Fix data integrity and cache invalidation first because those directly affect accounting trust.

## Research Sources

- Next.js 16 Proxy convention: middleware was renamed to proxy, and `middleware` is deprecated in v16. The app already uses `src/proxy.ts`, which is aligned. Source: https://nextjs.org/docs/app/api-reference/file-conventions/proxy
- Next.js 16 upgrade guide: `next lint` was removed; run ESLint/Biome directly. PPR is now tied to `cacheComponents`. Source: https://nextjs.org/docs/app/guides/upgrading/version-16
- React `useActionState`: server functions can return state before hydration and improve progressively enhanced forms. Source: https://react.dev/reference/react/useActionState
- TypeScript 6 announcement: TypeScript 6 is the JS-based bridge toward the Go-based TypeScript 7 compiler. Source: https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/
- Tailwind CSS 4 upgrade guide: v4 uses CSS-first config and modern browser baselines, with renamed utilities and changed defaults. Source: https://tailwindcss.com/docs/upgrade-guide
- Drizzle migrations: schema and migration workflows should keep a clear source of truth, with `generate`, `migrate`, `push`, and `pull` used deliberately. Source: https://orm.drizzle.team/docs/migrations
- Drizzle transactions: related SQL statements should be grouped in transactions and rolled back as one unit. Source: https://orm.drizzle.team/docs/transactions
- Neon pooling: web/serverless apps should use pooled connections; migrations and administrative operations should use direct connections. Source: https://neon.com/docs/connect/connection-pooling
- Neon serverless driver: v1 requires Node 19 or newer; pooled Client/Pool APIs are the correct fit for sessions and interactive transactions. Source: https://neon.com/docs/serverless/serverless-driver
- TanStack Query mutation invalidation: return/await invalidation promises from mutation callbacks when pending state should include refetching. Source: https://tanstack.com/query/v5/docs/framework/react/guides/invalidations-from-mutations
- Vitest 4 migration: `coverage.all` was removed and `coverage.include` is the recommended explicit coverage target. Source: https://vitest.dev/guide/migration

## Dependency Posture

Current package manager: `pnpm@11.1.0` in `package.json:5`.

Core versions:

| Package | Current | Latest observed | Recommendation |
| --- | ---: | ---: | --- |
| `next` | `16.2.6` | `16.2.7` | Patch after stability tests. |
| `react` | `19.2.6` | `19.2.7` | Patch with `react-dom`. |
| `react-dom` | `19.2.6` | `19.2.7` | Patch with `react`. |
| `typescript` | `6.0.3` | current line | Keep, but enforce strict project rules. |
| `drizzle-orm` | `^0.45.2` | current line | Keep; focus on transaction correctness. |
| `@neondatabase/serverless` | `^1.0.1` | current line | Keep; add Node engine guard. |
| `tailwindcss` | `^4` | current line | Keep; clean renamed utility usage. |
| `vitest` | `^4.1.6` | `4.1.8` | Patch after config cleanup. |
| `@playwright/test` | `^1.60.0` | current line | Keep. |
| `@biomejs/biome` | `2.4.15` | `2.4.16` | Patch. |
| `eslint` | `^10.4.0` | `10.4.1` | Patch. |
| `lefthook` | `^1.13.6` | `2.1.9` | Treat as a separate migration. |
| `@types/node` | resolved `20.19.40` | `25.9.1` | Stay on Node 20/22 types unless runtime changes. |

Other patch/minor updates observed: `@types/react`, `@vitest/coverage-v8`, `zustand`, `@hookform/resolvers`, `@tanstack/react-query`, `@vercel/blob`, `date-fns`, `lucide-react`, `motion`, `pg`, `react-hook-form`, `tailwind-merge`, `tsx`, `typescript-eslint`, and `ws`.

Do not upgrade everything blindly. Upgrade in two groups: safe patch/minor app dependencies first, then tooling and hook migration dependencies. Run typecheck, Biome, ESLint, unit tests, and finance e2e after each group.

## P0 Findings

### 1. Backups omit live database tables

Evidence:

- Schema defines `general_expenses` at `src/lib/db/schema.ts:779`, `owners` at `src/lib/db/schema.ts:804`, `owner_transactions` at `src/lib/db/schema.ts:823`, and `idempotency_keys` at `src/lib/db/schema.ts:1155`.
- Backup imports and `TABLE_NAMES` include many tables but omit `general_expenses`, `owners`, and `owner_transactions` in `src/actions/backup-actions.ts:44`.
- The backup manifest catches per-table failures and returns `{ name, count: 0 }` at `src/actions/backup-actions.ts:134`, which can make incomplete backups look successful.

Impact: a restore would silently lose company expenses and owner portal data. This is a data-resilience failure.

Fix plan:

1. Build `TABLE_NAMES` from a typed table registry that includes every exported table intentionally selected for backup.
2. Add a unit test that compares the registry against the schema table inventory, with an explicit allowlist for excluded operational tables.
3. Fail backup generation if any table count/read fails; do not report count `0` as success unless the table really has zero rows.
4. Consider excluding or encrypting sensitive fields such as password hashes, or document that backups are encrypted/private and access controlled.

### 2. Purchase receiving can double-post under concurrency

Evidence:

- `receivePurchaseOrder` starts at `src/actions/purchase-actions.ts:127`.
- The purchase order status is checked before inventory/supplier locks, but the purchase order row itself is not selected with `for("update")` before status transition.
- Inventory rows and supplier rows are locked at `src/actions/purchase-actions.ts:158` and `src/actions/purchase-actions.ts:198`, but that does not prevent two requests from receiving the same draft purchase order.
- Stock increments use `Math.floor(Number(item.quantity))` at `src/actions/purchase-actions.ts:166`, while schema purchase quantities are decimal, so fractional quantities are silently truncated.
- Supplier payment journal source uses `sourceType: "supplier_payment"` and `sourceId: po.id` at `src/actions/purchase-actions.ts:307-308`, which points to the purchase order instead of the inserted payment row.

Impact: a double-submit or concurrent request can double-increase stock, double-create AP ledger entries, and corrupt supplier balances. Fractional quantities can also be lost silently.

Fix plan:

1. Lock the purchase order row with `for("update")` inside the transaction before checking `status`.
2. Make receive idempotent by rejecting non-draft rows after the lock.
3. Either enforce integer purchase quantities at validation or store/increment decimal inventory consistently. Do not floor silently.
4. Return the inserted supplier payment id and use it as `journalEntries.sourceId`.
5. Add race-condition tests for two concurrent receive attempts.

### 3. Finance and dashboard cache invalidation is inconsistent

Evidence:

- SSoT cache tags exist in `src/lib/cache-tags.ts:7`.
- Finance dashboard cache uses raw tag `"finance"` at `src/actions/finance-dashboard-actions.ts:244`, `src/actions/finance-dashboard-actions.ts:364`, and `src/actions/finance-dashboard-actions.ts:423` instead of `CACHE_TAGS.FINANCE_REPORTS`.
- Dashboard finance cache uses raw tag `"dashboard:finance"` at `src/actions/dashboard-actions.ts:430`.
- Payment writes revalidate only project paths at `src/actions/payment-actions.ts:190-191`.
- Project cost and inventory consumption paths revalidate project/inventory pages but not finance tags at `src/actions/project-actions.ts:1163-1164`, `src/actions/project-actions.ts:1224-1226`, and `src/actions/project-actions.ts:1321-1322`.
- Company expense creation revalidates only `/finance/expenses` at `src/app/(dashboard)/finance/expenses/actions.ts:144`.

Impact: finance reports, dashboard quick view, and ledger screens can remain stale after writes. In an accounting app, stale totals are a correctness bug, not only a UX issue.

Fix plan:

1. Create a helper such as `revalidateFinance()` that calls `revalidateTag(CACHE_TAGS.FINANCE_REPORTS, "max")`, `revalidateTag(CACHE_TAGS.LEDGER, "max")`, `revalidateTag(CACHE_TAGS.DASHBOARD_FINANCE, "max")`, and the needed paths.
2. Replace raw tag strings in finance/dashboard cached functions with `CACHE_TAGS`.
3. Call the helper from every double-entry write: payments, vouchers, project costs, inventory consumption that changes COGS, purchases, supplier payments, cash transfers, manual journals, and general expenses.
4. Add tests that assert write actions call the expected tags.

### 4. Auth session sliding refresh is implemented but not used

Evidence:

- `SESSION_REFRESH_THRESHOLD_MS` is defined at `src/lib/auth/session.ts:27`.
- `getSessionAndRefresh` is exported at `src/lib/auth/session.ts:160`.
- `requireAuth` imports `getSessionFromCookie` and calls it at `src/lib/auth/validate.ts:5` and `src/lib/auth/validate.ts:37`.
- Dashboard layout calls `requireAuth()` at `src/app/(dashboard)/layout.tsx:24`.

Impact: users can be logged out according to absolute cookie expiry even though the session module documents a sliding window. This is stability/UX mismatch and can interrupt long finance workflows.

Fix plan:

1. Change `requireAuth` to use `getSessionAndRefresh` if all callers are server-side and cookie mutation is valid there.
2. Add regression tests for refresh threshold behavior.
3. Make sure proxy remains only an optimistic gate and does not become the source of truth.

### 5. Public API responses leak internal errors

Evidence:

- Health API returns disconnected DB status and raw error message at `src/app/api/health/route.ts:27-29`.
- Cron backup auth compares against `Bearer ${process.env["CRON_SECRET"]}` at `src/app/api/cron/backup/route.ts:7`; if the secret is missing, the endpoint has unsafe misconfiguration semantics.
- Cron backup returns raw backup error messages at `src/app/api/cron/backup/route.ts:27`.
- Backup download validates URLs using `blobUrl.includes(...)` at `src/app/api/backup/download/route.ts:41` and returns raw `error.message` at `src/app/api/backup/download/route.ts:67`.

Impact: unauthenticated or lower-trust clients can learn internals about DB availability, backup storage, and failure modes.

Fix plan:

1. Keep `/api/health` public but redact details. Return only `ok` or `degraded` plus timestamp.
2. Add an admin-only diagnostic endpoint or server logs for detailed DB errors.
3. Reject cron requests when `CRON_SECRET` is missing and log the misconfiguration server-side.
4. Validate backup blob URLs by parsing URL origin/path and matching exact folder prefix, not `includes`.
5. Return generic client errors and log detailed errors.

### 6. Service worker caches authenticated Next data

Evidence:

- `src/sw.ts:18` creates a `StaleWhileRevalidate` strategy for Next data.
- `src/sw.ts:50` matches same-origin `/_next/data/`.
- `src/sw.ts:32-33` enables `skipWaiting` and `clientsClaim`.

Impact: an authenticated finance app can serve stale or private route data from the service worker. This can conflict with server revalidation, permission changes, logout, or account switching.

Fix plan:

1. Remove `/_next/data/` runtime caching unless every cached response is proven public and user-agnostic.
2. Avoid caching authenticated HTML/data responses. Cache static assets, fonts, icons, and the offline shell only.
3. Version cache names and delete old data caches on activate.
4. Add a manual PWA test: login, mutate finance data, logout, reload, verify no stale private data appears.

## P1 Findings

### 7. Finance reports contain accounting/math mismatches

Evidence from the finance section:

- Trial balance and balance sheet report actions build on ledger lines and account metadata, but some report paths do not consistently filter by period/date semantics.
- Existing finance dashboard cache uses broad `"finance"` tags instead of finance SSoT tags.
- General expense action creates `journalEntryId: null` when no account/payment method is selected, so expense rows can exist outside double-entry.
- The finance expense client shows success immediately after `createExpense` without checking `ActionResponse.success` at `src/app/(dashboard)/finance/expenses/client.tsx:76`.

Impact: reported balances can disagree with ledger truth, and company expenses can be recorded without the accounting trail expected by the double-entry system.

Fix plan:

1. Treat the ledger as the accounting source of truth for every finance report.
2. Enforce double-entry for every finance write that is meant to affect accounting.
3. For non-posting drafts, make status explicit. Do not store accounting expenses as successful if no journal was posted.
4. Add fixture-based report tests: trial balance balances to zero, P&L excludes balance-sheet accounts, cash movement reconciles to cash ledger lines.

### 8. Mutation handling treats logical failures as successful mutations

Evidence:

- Mutation factory `onSuccess` checks `response.success` and shows an error toast if false at `src/hooks/mutation-factory.ts:69-77`.
- TanStack Query still sees the mutation as successful because the mutation function resolved.
- Global `MutationCache.onSuccess` invalidates queries based on meta at `src/components/providers.tsx:68-74`, but does not return/await the invalidation promise.

Impact: failed server actions can still trigger query invalidation and never enter mutation error state. UI state, retry behavior, and pending state become misleading.

Fix plan:

1. Make the mutation factory unwrap `ActionResponse`; throw an `ActionError` when `success === false`.
2. Preserve server error messages for toast and form field display.
3. Return `Promise.all(...)` from `MutationCache.onSuccess` so pending state includes invalidation when needed.
4. Add tests for success, logical failure, thrown failure, and auto-invalidation.

### 9. React keys generated during render cause unnecessary remounts

Evidence:

- Finance dashboard skeleton keys use `crypto.randomUUID()` at `src/app/(dashboard)/finance/finance-dashboard-client.tsx:387-388`.
- Ledger skeleton keys use it at `src/app/(dashboard)/finance/ledger/ledger-page-client.tsx:346-347` and `src/app/(dashboard)/finance/ledger/ledger-page-client.tsx:414-415`.
- Multiple report clients repeat the same pattern, for example `cash-movement-client.tsx:173-174`, `profit-loss-client.tsx:178-179`, and `manual-journal-form.tsx:395-396`.

Impact: random render-time keys force React to recreate elements every render. For loading skeletons this is mostly performance churn; in forms it can reset local subtree state.

Fix plan:

1. Use stable arrays such as `const SKELETON_ROWS = [0, 1, 2, 3, 4] as const`.
2. Use index keys only for static skeleton placeholders, with a Biome suppression comment if needed.
3. Keep `crypto.randomUUID()` only for persistent client-created form row ids, such as manual journal line ids.

### 10. Quotation update breaks transaction consistency

Evidence:

- `updateQuotation` performs substantial work inside a transaction.
- Inventory unit prices are fetched using `db.select` inside that transaction rather than `tx.select`, so the read is outside the transaction snapshot.

Impact: concurrent inventory price changes can make quotation recalculation inconsistent with the transaction.

Fix plan:

1. Replace inner `db` reads/writes with `tx` inside transaction bodies.
2. Add a lint/code-review rule: no root `db` usage inside transaction callbacks except clearly documented independent reads.

### 11. Search patterns are not escaped consistently

Evidence:

- Inventory search escaping exists elsewhere, but quotation search uses raw `%${search}%` patterns for `ilike`.

Impact: `%` and `_` in user input become wildcards, causing broader searches and potential slow queries.

Fix plan:

1. Add a shared `escapeLikePattern` helper.
2. Use it for all `LIKE`/`ILIKE` searches.
3. Add tests for literal `%`, `_`, and backslash.

### 12. Tailwind 4 compatibility needs cleanup

Evidence:

- The app uses Tailwind 4 style imports and PostCSS integration correctly.
- Scan found multiple legacy-style utilities such as `outline-none`, `shadow-sm`, and `rounded-sm` in app/components. Tailwind 4 still supports many aliases, but the upgrade guide documents renamed utilities and changed defaults.

Impact: not an immediate break, but a source of visual drift and future churn.

Fix plan:

1. Run the Tailwind upgrade tool in a branch and inspect changes.
2. Replace deprecated/renamed utilities where the new class is exact.
3. Visual-test key dashboard, finance, quotations, and login screens after changes.

### 13. Test code violates local TypeScript rules

Evidence:

- Project rules prohibit `as any`.
- Tests still contain `as any`, for example `src/actions/project-actions.more2.test.ts:13`, `src/actions/project-actions.guard.test.ts:14`, `src/actions/payment-actions.finance.test.ts:12`, and `src/actions/quotation-actions.create-duplicate.test.ts:21`.

Impact: tests can hide type contract regressions. This weakens the app's stated TypeScript discipline.

Fix plan:

1. Replace `as any` with typed fixture builders, `Partial<T>` narrowed through helpers, or `satisfies`.
2. Add lint enforcement for tests too.
3. Keep mock helpers close to module boundaries so tests remain readable.

### 14. Vitest 4 coverage config is incomplete

Evidence:

- `vitest.config.mts` defines coverage `exclude`, but no `coverage.include`.
- Vitest 4 migration guidance recommends explicit `coverage.include` after removal of `coverage.all`.

Impact: coverage may look better than it is because untested source files can be absent from coverage.

Fix plan:

1. Add `coverage.include: ["src/**/*.{ts,tsx}"]`.
2. Keep existing excludes for generated/schema/UI-only areas where intentional.
3. Track finance action/report coverage separately.

## P2 Findings

### 15. Dashboard layout is force dynamic

Evidence:

- `src/app/(dashboard)/layout.tsx` exports `dynamic = "force-dynamic"`.

Impact: the entire dashboard subtree gives up static shell/cached component opportunities. This may be necessary for auth, but it should be measured.

Fix plan:

1. Keep auth dynamic, but audit whether static child shells can use cached components.
2. Pilot Next 16 `cacheComponents` on low-risk dashboard read views after P0 fixes.
3. Measure TTFB and route render duration before changing defaults.

### 16. Exported server actions need more explicit return contracts

Evidence:

- Several exported actions infer return types, especially in purchase and project workflows.

Impact: inferred public action contracts drift more easily, especially around `ActionResponse` failures.

Fix plan:

1. Add explicit `Promise<ActionResponse<...>>` to exported actions.
2. Use discriminated result types for known business failures where the UI needs field-level handling.

### 17. Next config is mostly modern, but runtime should be pinned

Evidence:

- `next.config.mjs` uses Next 16-compatible direct lint tooling, `serverExternalPackages`, image formats, and `optimizePackageImports`.
- Neon serverless driver v1 requires Node 19 or newer.

Impact: without a package/runtime engine guard, local, CI, and Vercel environments can drift.

Fix plan:

1. Add `engines.node` to `package.json`, preferably targeting Node 22 LTS or at least `>=20.19 <26`.
2. Mirror that in CI and Vercel project settings.

## Improvement Roadmap

### Phase 0: Baseline and Guardrails

1. Run `pnpm typecheck`, `pnpm biome:check`, `pnpm lint:eslint`, `pnpm test:code`, and Playwright smoke/e2e.
2. Record current failing tests before changes.
3. Add CI gates for typecheck, Biome, ESLint, unit tests, and a small finance smoke suite.

### Phase 1: Data Integrity and Security

1. Fix backup table completeness and backup failure semantics.
2. Lock purchase orders during receive and fix supplier payment source ids.
3. Redact public API error messages.
4. Remove authenticated Next data caching from the service worker.
5. Switch `requireAuth` to the sliding-refresh session path and test it.

### Phase 2: Finance Correctness

1. Centralize finance cache invalidation.
2. Enforce double-entry behavior for company/general expenses.
3. Correct finance report date/account classification logic.
4. Add ledger-based fixture tests for trial balance, balance sheet, P&L, cash movement, AR aging, and AP aging.

### Phase 3: Client State and UI Performance

1. Fix mutation factory semantics so logical server failures throw.
2. Await TanStack Query invalidations from the mutation cache.
3. Replace render-time random skeleton keys with stable keys.
4. Adopt `useActionState` selectively for server-action forms where progressive enhancement and field errors matter.

### Phase 4: Dependency Updates

1. Update safe patch/minor dependencies: Next, React, React DOM, Biome, ESLint, Vitest, coverage, TanStack Query, Zustand, React Hook Form, Tailwind Merge, `pg`, `ws`, `tsx`, and `typescript-eslint`.
2. Run the full verification matrix.
3. Handle `lefthook` v2 as a separate migration.
4. Keep `@types/node` aligned with the chosen Node runtime, not the newest possible major by default.

### Phase 5: Performance Modernization

1. Measure route TTFB and client bundle size before tuning.
2. Introduce `cacheComponents` only after cache invalidation is reliable.
3. Review large client components in finance reports and split client-only interaction from server-rendered tables where practical.
4. Use Playwright traces and Web Vitals for actual bottlenecks instead of speculative rewrites.

## Verification Matrix

Run after each phase:

```bash
pnpm typecheck
pnpm biome:check
pnpm lint:eslint
pnpm test:code
pnpm exec playwright test
pnpm build
```

Finance-specific checks:

```bash
pnpm test src/actions/*finance*.test.ts
pnpm test src/actions/*purchase*.test.ts
pnpm test src/lib/finance
```

Manual checks:

1. Receive the same purchase order twice in parallel; only one should post.
2. Create a company/general expense; ledger, finance dashboard, P&L, and cash movement should refresh and reconcile.
3. Logout after visiting finance pages; reload offline/online and confirm no private data is shown from service-worker caches.
4. Generate a backup and verify all schema tables are represented or intentionally excluded.

## Suggested First Pull Requests

1. `fix/backup-completeness-and-api-redaction`
2. `fix/purchase-receive-transaction-locking`
3. `fix/finance-cache-invalidation`
4. `fix/session-refresh-and-mutation-errors`
5. `chore/dependency-patch-batch`

This ordering reduces the risk of stabilizing stale or corrupt states with a dependency update before the business logic is solid.
