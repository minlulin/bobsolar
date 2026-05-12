# BOB Solar — 3P Deep-Scan Audit

Scope: full read of `minlulin/bobsolar@main`. No code changes. Citations are `path:line`.

Findings are ordered by severity within each "P". Severity tags:

- 🔴 **Critical** — security, data-loss, or guaranteed prod incident.
- 🟠 **High** — frequent perf or correctness drift, surfaces under load or growth.
- 🟡 **Medium** — design risk, will compound as the codebase grows.

---

## 1. Performance Latency — Where it drifts

### 🔴 Write-on-read in every quotation detail page

`src/actions/quotation-actions.ts:144-154`
Every `getQuotation(id)` issues an `UPDATE quotations SET status='expired'` BEFORE the SELECT, even when the quote is `draft`, `accepted`, or already `expired`. The WHERE filter rejects most rows server-side, but each detail-page hit still pays for a round-trip write transaction. Move expiry to a scheduled job (Vercel Cron) — never write on read.

### 🟠 Triple DB hit per dashboard render (layout amplification)

`src/app/(dashboard)/layout.tsx:21-29` calls `requireAuth()` which already does:

- `getSession()` — `src/lib/auth/session.ts:169` (sessions table)
- `getUserRoleFromDb()` — `src/lib/auth/validate.ts:18` (users table for role)

…then the layout fires a THIRD query (`db.query.users.findFirst`) for the user's `name + role` it just discarded. Plus a session-refresh `UPDATE` once per 24h.

`requireAuth()` is also re-invoked inside every page (e.g. `src/app/(dashboard)/projects/[id]/page.tsx:13`) and every server action, redoing the same 2 reads. There is no `React.cache()` wrapper, so SSR for a single page can issue 6–10 auth-related queries.

### 🟠 `unstable_cache` keys explode with raw search strings

`src/actions/quotation-actions.ts:54-101`, `src/actions/inventory-actions.ts:22-60`.
The cache key includes the raw `search` string. Each unique user query allocates a new entry that is never reused; `revalidateTag('quotations:list')` empties the tag but cold memory still grows in the runtime cache. Pin search through trgm-bounded prefix length and salt the key by normalized form.

### 🟠 Cartesian fan-out in scheduled notification checks

`src/actions/notification-actions.ts:342-364`.
For each `due_soon` warranty alert, builds one notification per user (`allUserIds × alerts`); same for `overdue × admins`. Each run also issues a `SELECT … WHERE userId IN (…) AND dedupeKey IN (…)` whose IN-lists grow with backlog. Backlog of 200 alerts × 3 users → 600 INSERTs and 600-element IN-clauses per cron tick. Build the dedupe filter from `(user_id, dedupe_key)` tuples via `SELECT FROM unnest()` or store dedupe in a `unique` index (see Pain Points #4).

### 🟠 `getWarrantySummary` — 4 sequential COUNT(\*) round-trips

`src/actions/warranty-actions.ts:55-113`. Fold into a single `SELECT count(*) FILTER (WHERE …) AS overdue, …`.

### 🟠 `getWarrantyAlerts` — unbounded result set

`src/actions/warranty-actions.ts:115-149` returns ALL alerts for the chosen tab with no `limit`/`offset`. Combined with three-way join (alerts → projects → customers) over the entire history, this will brown out the page once you cross a few thousand records.

### 🟠 `addProjectCost` waterfall

`src/actions/project-actions.ts:684-726`. For one cost insert you pay:

1. `find project`
2. `sumProjectCosts(projectId)` (full SUM)
3. `INSERT cost`
4. `persistActualTotal(projectId)` → another full SUM + UPDATE projects
5. `maybeNotifyBudgetOverrun()` → ANOTHER full SUM
6. `findMany costs` for the response

`sumProjectCosts` runs 3 times for one mutation. The second SUM can be computed locally as `previousSpend + insertedAmount`.

### 🟠 `bulkUpdatePrices` JS-for-UPDATE in a transaction

`src/actions/inventory-actions.ts:218-228`. Sequential per-row UPDATEs inside a tx — N network round-trips. Use a single `UPDATE inventory_items AS t SET unit_price = v.price FROM (VALUES …) AS v(id, price) WHERE t.id = v.id::uuid`.

### 🟡 Drizzle relational `with: { ... }` ≠ JOIN

`src/actions/quotation-actions.ts:74-94`, `src/actions/project-actions.ts:462-495`.
`db.query.X.findMany({ with: { … } })` issues separate sub-queries per relation. For paginated lists with multiple `with`s this is N+1-shaped (1 + relations) per page. For the project detail page it's 5+ statements you could collapse with `leftJoin`s.

### 🟡 Dashboard fires 12 parallel queries

`src/actions/dashboard-actions.ts:82-175`. `Promise.all` is the right shape, but 12 simultaneous statements per page load through Neon's WS channel will spike connection use under load; consider one aggregated query with `FILTER` clauses.

### 🟡 Notification client polls every 30s

`src/hooks/use-notifications.ts:39` — `refetchInterval: 30_000`. With multiple tabs open, sustained read pressure on `notifications`. Switch to SSE or pg `LISTEN/NOTIFY` for push, or back off when window is hidden.

### 🟡 Project list (completed) does a second IN-query for warranty rollup

`src/actions/project-actions.ts:425-447`. Folds into the main aggregate with a `LATERAL` or `bool_or` over `warranty_alerts`.

### 🟡 Auth rate-limit cleanup runs synchronously inside login failure path

`src/actions/auth-actions.ts:107-115`. The `DELETE FROM auth_rate_limits WHERE …` for stale rows runs on every failed login attempt, adding latency to the slowest path. Move to a scheduled cleanup job.

---

## 2. Business Logic — Where it hurts

### 🔴 Settings & user-management actions skip role checks → privilege escalation

`src/actions/settings-actions.ts:75-258`. Every mutation here uses `requireAuth()`, not `requireAdmin()`:

- `setCompanyLogoUrl`, `updateCompanySettings` — any staff can rebrand or wipe company contact info.
- `getSettingsUsers` — and worse, returns hard-coded `isAdmin: true` at `settings-actions.ts:170`, so the UI treats every user as admin.
- `updateSettingsUser`, `createSettingsUser` — any staff can edit/create users (subject to `USER_CAP=3` in `src/lib/domain/policies.ts`).
- 🔴🔴 `resetSettingsUserPassword(userId)` — `settings-actions.ts:236-258` — any logged-in staff can pass the admin's `userId`, receive a fresh temp password in the response, and take over the admin account. The admin's existing sessions are revoked, so the admin is logged out and the attacker walks in.

`requireAdmin` exists at `src/lib/auth/validate.ts:35` but is **never imported by any action** (greps clean across `src/actions/**`). It's only referenced in tests.

### 🔴 Advisory lock and transaction can run on different connections

`src/actions/quotation-actions.ts:204-211` + `src/lib/utils/advisory-lock.ts:30-37`. `pg_try_advisory_lock` is **session-scoped** — it lives on the connection that took it. The code does:

```ts
const lock = new AdvisoryLock(db, lockKey);  // db.execute() on connection A
const acquired = await lock.acquire();
…
const result = await db.transaction(async (tx) => { … }); // tx on connection B (likely)
```

With `@neondatabase/serverless` `Pool` (`src/lib/db/index.ts:16`) each `db.execute` and `db.transaction` may check out a different socket. The lock guards connection A while the insert happens on B — the mutual exclusion is **theatrical**. What actually keeps quote numbers unique is the `quote_number unique` constraint + the retry-on-23505 loop (line 275-287). Either drop the advisory-lock dance or run the lock acquire **inside** the same transaction so it uses the tx's connection.

### 🟠 Notification dedupe is application-only — race possible

`src/actions/notification-actions.ts:42-67` and `285-309`. The dedupe pattern is "SELECT existing keys → filter candidates → INSERT". Two concurrent `runScheduledNotificationChecks` runs (or two server-action invocations) will both see the empty set and double-insert. The schema has only a non-unique `notifications_dedupe_key_idx` (`drizzle/migrations/0005_operational-indexes.sql`). Promote to `UNIQUE (user_id, notification_dedupe_key)` and use `onConflictDoNothing()`.

### 🟠 Quotation-number / project-number sequence read outside the transaction

- `src/actions/quotation-actions.ts:218-227` — uses the outer `db.query` while the insert is inside a `tx`.
- `src/actions/project-actions.ts:100-110` (`nextProjectSequence`) — same, called from inside `db.transaction(...)` at line 265 but using module-level `db`.

The unique index catches duplicates and the retry loops succeed eventually, but the design's stated invariant ("read max, insert max+1") is broken. The fix is `tx.select(…)` or, better, a `pg_sequence` per year prefix.

### 🟠 `convertQuotationToProject` does not lock the quotation row

`src/actions/project-actions.ts:211-322`. Reads `quotation.findFirst` without `FOR UPDATE`. Concurrent conversions of the same accepted quote are blocked only by the partial unique index `projects_quotation_id_unique` (`drizzle/migrations/0003_clever_avengers.sql`). On 23505 it retries (line 296-307), but the retry re-runs `findFirst` and now sees `project != null` → returns state error. End user gets a misleading "already linked" error instead of "another agent is converting this quote". Add `for update` and surface a clean message.

### 🟠 MMK math rounds at every step → reconciliation drift

`src/lib/pricing/engine.ts:19-55`. `Math.round` is applied at: per line item, global discount, tax. Compounding rounding can shift the stored `total` from the externally-reconciled invoice total by ±N MMK for an N-line quote. Worse: the persisted `quotation_items.totalPrice` (snapshot) does NOT include the proportional global discount/tax, so re-summing `quotation_items` from the DB will not equal `quotations.total`. Pick one strategy and document it; ideally round only at the final `total` boundary, and store proportionally allocated line totals if you need re-summable history.

### 🟠 `applyProjectCompletion` is split across the transaction boundary

`src/actions/project-actions.ts:533-553`. The status-change UPDATE is in one statement; `persistActualTotal()` (UPDATE), `seedDefaultWarrantyAlerts()` (INSERTs), and `notifyAllUsers()` (more INSERTs) all run after, on raw `db`, not wrapped in a transaction. If `seedDefaultWarrantyAlerts` fails, the project is marked completed but the warranty rhythm is silently missing for that customer.

### 🟡 State machine permits `accepted → draft` and `accepted → rejected`

`src/lib/domain/enums.ts:60-67`. The runtime check in `updateQuotationStatus` (`quotation-actions.ts:319-329`) blocks status changes after a project link exists, which papers over the looseness. But before a project is linked, an accepted quote can be reverted to draft, losing the audit thread. Document or tighten — at minimum require an explicit "reopen" reason.

### 🟡 Rate-limit window resettable by a 1h pause

`src/actions/auth-actions.ts:88-95`. `entry.lastAttemptAt < windowStart ? 0 : entry.attempts` — an attacker pacing 5 attempts/hour resets the counter forever. With `MAX_FAILED_ATTEMPTS=5`, effective rate post-lockout is 5/hour indefinitely. Use a sliding-window or exponential backoff (`lockedUntil = now + 15m * 2^(streak-1)`).

### 🟡 `notifyAllUsers` has no dedupe

`src/lib/notifications/broadcast.ts:12-27`. Called from quote acceptance and project completion. A retried server-action (network hiccup → user clicks again) double-notifies everyone. Add a dedupe key (e.g. `quote-accepted-${id}`, `project-completed-${id}`).

### 🟡 Customer soft-delete does not cascade to quotations / projects

`src/actions/customer-actions.ts:156-177`. Archiving a customer leaves their quotations/projects visible — by design? UX is inconsistent: customer dropdowns hide archived customers, but their quotes still appear in the list and reference a hidden customer.

### 🟡 `getWarrantyAlerts` returns the entire table when `tab='all'`

`src/actions/warranty-actions.ts:49-51`. Combined with no pagination (#getWarrantyAlerts above).

### 🟡 No audit trail

Critical mutations (price changes via `bulkUpdatePrices`, password resets, settings changes, status transitions) leave no log beyond the affected row's `updatedAt`. For a solar-business operations engine this is a compliance gap, not just a nice-to-have.

---

## 3. Production Deployment — Where it breaks

### 🔴 Vercel builds run `pnpm drizzle-kit push` against the live DB

`vercel.json:2`:

```json
"buildCommand": "pnpm typecheck && pnpm lint && pnpm drizzle-kit push && pnpm build"
```

`drizzle-kit push` is the **non-migrational** schema sync — it diffs the current `schema.ts` against the live database and applies whatever DDL is needed, **including DROP COLUMN / DROP TABLE**. Problems:

1. The repo has 11 proper migrations in `drizzle/migrations/` that `push` ignores. The migration journal in `drizzle/migrations/meta/_journal.json` is bypassed.
2. Reverting a branch on `main` will cause the next deploy to drop newly-added columns from production.
3. If `next build` fails after `push` succeeds, you have a deployed build pointing at a schema that no longer matches the previous code.
4. **Preview deployments will run the same command.** Unless Vercel's `DATABASE_URL` differs per branch (Neon branching), preview branches mutate the production schema.

Fix: replace with `pnpm db:migrate` (already defined in `package.json:13`).

### 🔴 Iron-session falls back to a known placeholder secret

`src/lib/auth/session.ts:21-41`.

```ts
function getSessionSecretOrPlaceholder(): string {
  const secret = process.env['SESSION_SECRET'];
  return secret && secret.trim().length >= 32
    ? secret
    : 'insecure-placeholder-secret-insecure-placeholder-secret';
}
const ironSessionConfig: SessionOptions = {
  cookieName: SESSION_COOKIE_NAME,
  password: getSessionSecretOrPlaceholder(),
  …
};
```

This config is captured **once at module evaluation** with whatever value `SESSION_SECRET` had at that moment. The runtime `assertSessionSecret()` in entry points throws AFTER the seal config is set — so a deployment where the env var is missing or evaluated late still seals/unseals with the hard-coded placeholder. Cookies sealed with that placeholder are forgeable by anyone reading this repo. In production, refuse to start (fast-fail) when `SESSION_SECRET` is missing instead of papering over it.

### 🔴 No middleware → no central auth enforcement

`find src -name middleware.ts` → empty. Every page (and the SSR layout) must remember to call `requireAuth()` itself. A new route under `(dashboard)/` that forgets the call leaks data — there is no failsafe. Add `src/middleware.ts` matching `(dashboard)` paths and the `/api/upload` route to enforce a valid session at the edge.

### 🟠 No security headers

`next.config.mjs:1-30` exports no `async headers()`. No CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy. The only CSRF-ish defence is the upload route's origin check (`src/app/api/upload/route.ts:10-22`); server actions rely on Next.js's built-in token but that's still a thin perimeter.

### 🟠 Overlapping migration files

`drizzle/migrations/0007_auth-rate-limits-and-customer-archive.sql` and `drizzle/migrations/0010_wooden_magdalene.sql` both `CREATE TABLE IF NOT EXISTS "auth_rate_limits"` and add `customers.archived_at`. With proper `db:migrate` the journal prevents re-application — but the current `push`-based pipeline will silently ignore the duplication. If you ever switch back to `migrate`, double-check that `0010` is intentional and not a re-generation of `0007`.

### 🟠 Connection pool not sized for serverless

`src/lib/db/index.ts:9-19`. `new Pool({ connectionString })` with defaults (`max=10` by default for `pg`, varies for neon-serverless). Vercel runs many concurrent Lambdas; each warm function holds a pool. On Neon Free (≈100 connection cap) you saturate quickly. Options:

- Set `max: 1` per function instance.
- Use the HTTP driver (`drizzle-orm/neon-http`) for short read paths; reserve the WS pool for transactions.

### 🟠 No observability / structured logging

`src/lib/utils/error.ts:73-91` `console.error(JSON.stringify(errorInfo, null, 2))` is the only sink. Vercel collects stdout but there is no alerting, no Sentry, no request-id, no PII redaction. The dev-mode error chain (`error.ts:96-102`) walks `Error.cause` and leaks DB-driver messages verbatim to the client — fine in dev, but make sure NODE_ENV is definitely `production` in prod (it is on Vercel by default, but a leaked secret note is worth re-stating).

### 🟡 Service-worker only enabled in production

`next.config.mjs:13-23`. Defensible (Turbopack-Serwist conflict), but it means caching/offline regressions don't surface until after deploy. Add a manual `pnpm build && pnpm start` smoke check in CI.

### 🟡 No `.github/workflows/` — only local "green" scripts

`package.json:14-25` defines `green:code`, `green:db`, `green` — but there's no CI configured to run them. Vercel's `buildCommand` runs `typecheck && lint && drizzle-kit push && build`, which skips tests. A bad migration or a broken business action ships to prod without `pnpm test:db` ever running.

### 🟡 `getCachedSharedStats` cached for 300s but `viewer` uncached

`src/actions/dashboard-actions.ts:73-261`. The 12-statement aggregate is correctly shared across users — good. But the per-user `viewer` query (line 202-207) runs uncached. Wrap it in `React.cache()` so a single page render doesn't fan out unnecessarily.

### 🟡 Pre-PWA bundle: `framer-motion` + heavy radix UI in main bundle

The PDF renderer is correctly dynamic-imported (`src/app/(dashboard)/quotations/[id]/pdf/route.ts:46-49`). But `framer-motion` is imported in the dashboard layout and login page entry points. Audit `bundle-analyzer` output (`@next/bundle-analyzer` is already wired in `next.config.mjs:6-9`); set a First-Load-JS budget.

---

## Priority — fix-it-tomorrow list

| #   | Item                                                                                                            | Severity | Effort |
| --- | --------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| 1   | Add `requireAdmin()` to every settings/user-management action; remove the hard-coded `isAdmin: true`            | 🔴 sec   | S      |
| 2   | Replace `drizzle-kit push` with `db:migrate` in `vercel.json`                                                   | 🔴 ops   | S      |
| 3   | Fail-fast on missing `SESSION_SECRET` (remove placeholder fallback)                                             | 🔴 sec   | S      |
| 4   | Add a root `middleware.ts` enforcing session on `(dashboard)/` paths and `/api/upload`                          | 🔴 sec   | S      |
| 5   | Move the advisory-lock acquire/release inside the same `db.transaction` callback                                | 🟠 corr  | S      |
| 6   | Stop write-on-read in `getQuotation`; expire quotes via a daily cron                                            | 🟠 perf  | S      |
| 7   | Add `UNIQUE(user_id, notification_dedupe_key)` index, then use `onConflictDoNothing()`                          | 🟠 corr  | S      |
| 8   | Wrap `applyProjectCompletion` in one transaction (status update + persist total + seed warranty alerts)         | 🟠 corr  | M      |
| 9   | Switch dashboard counts to one `FILTER`-aggregated query; cache `requireAuth()` per request via `React.cache()` | 🟠 perf  | M      |
| 10  | Add CI workflow running `pnpm green` (typecheck + lint + tests + db migrations)                                 | 🟠 ops   | S      |
| 11  | Add `headers()` block with CSP, HSTS, X-Frame-Options, Referrer-Policy in `next.config.mjs`                     | 🟠 sec   | S      |
| 12  | Add `audit_log` table for price changes, settings updates, password resets, status transitions                  | 🟡 gov   | M      |

The first four items are deploy-day-priority — every one of them is a single-incident-away-from-headline risk.
