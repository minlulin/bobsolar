# Strict TypeScript PWA Codebase Audit

Audit date: 2026-05-10  
Project: BOB Solar, Next.js 16 App Router PWA  
Scope: TypeScript strictness, SSoT, hardcoded values, client/server boundaries, Server Actions, DB, validators, hooks, PWA, lint/test/build/deployment readiness.

## Verification Snapshot

| Check             | Result                                                         |
| ----------------- | -------------------------------------------------------------- |
| `pnpm typecheck`  | Pass                                                           |
| `pnpm lint`       | Pass                                                           |
| `pnpm test`       | Pass, 2 files / 16 tests                                       |
| `pnpm build`      | Pass                                                           |
| Extra strict pass | Fail: third-party lib checks plus local strict-policy findings |

Extra strict command used:

```bash
pnpm exec tsc --noEmit --noImplicitReturns --noUnusedLocals --noUnusedParameters --noImplicitOverride --noPropertyAccessFromIndexSignature --allowUnusedLabels false --allowUnreachableCode false --skipLibCheck false
```

Important build warning:

```text
[@serwist/next] WARNING: You are using '@serwist/next' with `next dev --turbopack`, but it doesn't support Turbopack.
```

## Executive Verdict

The project is deployable today because the normal typecheck, lint, tests, and production build pass. It does not fully satisfy the requested strict TypeScript policy, does not fully follow SSoT, and has several high-severity real-world business and authorization risks.

The highest-risk areas are:

1. Database client initialization happens at module scope and loads `.env.local` inside app code.
2. Session cookies are bearer tokens only; `SESSION_SECRET` is documented but unused.
3. Non-admin users can update company settings, upload/set logo branding, mark projects completed, resolve/reopen warranty alerts, and call notification generation actions.
4. PWA manifest metadata points to `/manifest.json`, while Next emits `/manifest.webmanifest`.
5. The seed script creates a known admin password.
6. Quote/project conversion lacks transactional uniqueness and can duplicate projects under concurrency.
7. Several exported Server Actions trust typed inputs without runtime validation.

## TypeScript Strict Mode

### TS-001 - Strict mode is incomplete against the AGENTS zero-tolerance policy

Severity: High  
Evidence: `tsconfig.json` enables `strict`, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes`, but keeps `allowJs: true` and `skipLibCheck: true`, and omits explicit strict policy flags such as `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `allowUnusedLabels: false`, and `allowUnreachableCode: false`.  
Impact: The advertised "strict TypeScript" gate is weaker than the project rules. Dead imports, missing returns, env access style violations, and library incompatibilities can pass normal CI.  
Helper action: Split app and service-worker tsconfigs, disable `allowJs` unless needed, enable the missing compiler flags, and only relax `skipLibCheck` with documented third-party exceptions.

### TS-002 - Extra strict compiler pass exposes local issues

Severity: Medium  
Evidence:

- `src/components/layout/notification-bell.tsx:46` has an effect where not all code paths return a value under `noImplicitReturns`.
- `src/lib/db/index.ts:8` and `src/lib/db/index.ts:12` violate `noPropertyAccessFromIndexSignature`.
- `src/lib/storage/blob.ts:5` violates `noPropertyAccessFromIndexSignature`.
- Unused React imports appear in several TSX files under `noUnusedLocals`.

Impact: These are small, but they prove the current CI gate does not enforce the requested strictness.  
Helper action: Fix the local strict-pass findings first, then decide whether third-party declaration failures require tsconfig segmentation or pinned dependency fixes.

### TS-003 - `dom` and `webworker` libs are mixed in the root tsconfig

Severity: Medium  
Evidence: `tsconfig.json` includes both `dom` and `webworker`. The extra strict pass reports duplicate global definitions from `lib.dom.d.ts` and `lib.webworker.d.ts`.  
Impact: Service worker types and browser window types collide. This hides PWA typing problems and blocks `skipLibCheck: false`.  
Helper action: Create a separate `tsconfig.sw.json` for `src/sw.ts` with `webworker`, and keep the app tsconfig on `dom`/`dom.iterable`.

### TS-004 - Unsafe casts and non-null assertions bypass strict guarantees

Severity: Medium  
Evidence:

- `src/actions/customer-actions.ts:109` and `src/actions/inventory-actions.ts:113` cast `raw` to `Record<string, unknown>`.
- `src/actions/quotation-actions.ts:101`, `src/actions/quotation-actions.ts:156`, and `src/app/(dashboard)/projects/new/page.tsx:211` use broad result casts.
- `src/app/(dashboard)/quotations/new/components/quote-preview.tsx:24` and `src/app/(dashboard)/quotations/new/components/quote-editor.tsx:81` use non-null assertions.

Impact: Runtime payload shape, relation shape, and route state can differ from the cast, causing hidden crashes that TypeScript will not catch.  
Helper action: Use Zod parsing at the boundary and typed Drizzle relation result helpers instead of asserting final shapes.

## SSoT And Hardcoded Values

### SSOT-001 - Domain enums are duplicated across schema, validators, UI, and hooks

Severity: High  
Evidence:

- DB enums live in `src/lib/db/schema.ts:19`, `src/lib/db/schema.ts:44`, `src/lib/db/schema.ts:54`, `src/lib/db/schema.ts:62`, `src/lib/db/schema.ts:69`, `src/lib/db/schema.ts:75`, and `src/lib/db/schema.ts:81`.
- Validators repeat enums in `src/lib/validators/quotation.ts:28`, `src/lib/validators/project.ts:43`, `src/lib/validators/project.ts:50`, `src/lib/validators/project.ts:55`, and `src/actions/settings-actions.ts:22`.
- UI repeats status unions in `src/hooks/use-quotations.ts:66`, `src/app/(dashboard)/projects/[id]/project-detail-shell.tsx:73`, and `src/app/(dashboard)/settings/components/user-management-tab.tsx:35`.

Impact: Future status/category changes can compile in one layer and silently break another.  
Helper action: Export enum value arrays from one domain constants module or from Drizzle enum `enumValues`, and build Zod schemas, UI labels, and transitions from that source.

### SSOT-002 - `ActionResponse` has two sources

Severity: Medium  
Evidence: `src/actions/inventory-actions.ts:15` defines `ActionResponse<T>`, while `src/lib/utils/action-response.ts:11` defines the same concept. Other files import the inventory action type as a shared type.  
Impact: A domain action file has become a shared infrastructure module. This creates circular ownership and makes response-shape changes error-prone.  
Helper action: Move all actions to import `ActionResponse` from `src/lib/utils/action-response.ts`.

### SSOT-003 - Currency formatting is duplicated

Severity: Medium  
Evidence: `src/lib/pricing/engine.ts:57` and `src/lib/utils.ts:8` both implement `formatMMK`.  
Impact: Formatting differences can appear between PDF, dashboard, cards, and tests.  
Helper action: Keep one `formatCurrency`/`formatMMK` helper and import it everywhere.

### SSOT-004 - Settings keys are stringly typed and repeated

Severity: Medium  
Evidence: `company_logo_url` is defined in both `src/actions/settings-actions.ts:12` and `src/app/(dashboard)/settings/page.tsx:26`. Other keys appear in settings page, seed, PDF, and branding action.  
Impact: Renaming a company setting breaks branding/PDF behavior without type feedback.  
Helper action: Create a `CompanySettingKey` enum/const object and a Zod schema for allowed settings payloads.

### HC-001 - Seed script ships a known admin credential

Severity: Critical  
Evidence: `src/lib/db/seed.ts:9` hashes `admin123`, and `src/lib/db/seed.ts:13` creates `admin@bobsolar.com`. The login page placeholder also exposes that email in `src/app/(auth)/login/page.tsx:141`.  
Impact: If seed is run in production or staging, the app has a predictable privileged login.  
Helper action: Require `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`, reject weak/default values, and never document a real admin placeholder in UI.

### HC-002 - PDF bank details and company fallback data are hardcoded

Severity: High  
Evidence: `src/components/pdf/quote-document.tsx:28` to `src/components/pdf/quote-document.tsx:38` hardcode company identity, tax ID, and bank account numbers.  
Impact: Real quotes can show fake or stale legal/payment information, which is a business-critical billing failure.  
Helper action: Store all quote-facing legal/payment fields in validated company settings and remove bank account fallbacks.

### HC-003 - Business policy values are scattered

Severity: Medium  
Evidence: Session length is `7 * 24 * 60 * 60 * 1000` in `src/lib/auth/session.ts:7`; upload max is `5 * 1024 * 1024` in `src/app/api/upload/route.ts:6`; warranty windows are `30`, `7`, and `3` days across warranty and notification actions; project budget threshold is `1.1` in `src/actions/project-actions.ts:189`; user cap is `3` in `src/actions/settings-actions.ts:201`.  
Impact: Policy changes require grep-driven edits and can diverge across UI, validators, and server actions.  
Helper action: Centralize policy constants under `src/lib/domain/policies.ts` and import them in validators and UI.

## Auth, Sessions, And Authorization

### AUTH-001 - Session cookies are unsigned bearer tokens; `SESSION_SECRET` is unused

Severity: Critical  
Evidence: `.env.example` and README document `SESSION_SECRET`, but `rg` found no runtime usage. `src/lib/auth/session.ts:24` stores raw `session_id` in a cookie, and `src/lib/auth/session.ts:35` trusts that bearer token if found in DB.  
Impact: Any leaked session ID is sufficient for account takeover until expiry. There is no signing, no binding, no rotation on password change, and no secret-based verification despite documentation.  
Helper action: Either remove `SESSION_SECRET` documentation or, preferably, sign/encrypt the session cookie and rotate/delete sessions on password or role changes.

### AUTH-002 - Role is duplicated in sessions and can become stale

Severity: High  
Evidence: `sessions.role` is `text` in `src/lib/db/schema.ts:103`, `createSession` stores the current role in `src/lib/auth/session.ts:16`, and `requireAuth` casts it to `UserRole` in `src/lib/auth/validate.ts:20`. `updateSettingsUser` changes `users.role` in `src/actions/settings-actions.ts:177` but does not invalidate sessions.  
Impact: A demoted admin can keep admin privileges until session expiry. A role typo in session storage is hidden by the cast.  
Helper action: Remove role from sessions and read role from `users` on auth checks, or invalidate all sessions for that user whenever role/email/password changes.

### AUTH-003 - Settings mutations are available to any authenticated user

Severity: Critical  
Evidence:

- `setCompanyLogoUrl` calls `requireAuth()` at `src/actions/settings-actions.ts:59`.
- `updateCompanySettings` calls `requireAuth()` at `src/actions/settings-actions.ts:91`.
- The Settings page exposes company editing UI without using `usersQuery.data?.isAdmin`; it is explicitly discarded at `src/app/(dashboard)/settings/page.tsx:137`.

Impact: Staff users can alter company name, phone, bank details, logo, and quote-facing identity.  
Helper action: Require admin for all company/branding settings mutations and hide or disable company settings UI for non-admin users.

### AUTH-004 - Any authenticated user can mark projects completed

Severity: High  
Evidence: UI only shows status dropdown to admins in `src/app/(dashboard)/projects/[id]/project-detail-shell.tsx:377`, but the "Mark completed" button is visible to all authenticated users at `src/app/(dashboard)/projects/[id]/project-detail-shell.tsx:408`. The action only calls `requireAuth()` in `src/actions/project-actions.ts:607`.  
Impact: Staff can finalize projects, freeze financial ledger behavior, generate warranty alerts, and broadcast completion notifications without admin approval.  
Helper action: Require admin or a dedicated `project_manager` permission in `markProjectCompleted`.

### AUTH-005 - Warranty resolution and alert creation are not role-gated

Severity: High  
Evidence: `resolveWarrantyAlert`, `reopenWarrantyAlert`, and `createWarrantyAlertForProject` call only `requireAuth()` in `src/actions/warranty-actions.ts:155`, `src/actions/warranty-actions.ts:192`, and `src/actions/project-actions.ts:796`.  
Impact: Any staff member can clear service obligations or create alerts for all users.  
Helper action: Gate warranty mutation actions with admin/project-manager authorization and audit who resolved/reopened each alert.

### AUTH-006 - Notification generation actions are callable by normal users

Severity: High  
Evidence: `createNotification` and `runScheduledNotificationChecks` call only `requireAuth()` at `src/actions/notification-actions.ts:120` and `src/actions/notification-actions.ts:146`.  
Impact: Authenticated users can generate arbitrary notifications or repeatedly run scheduled checks, creating spam and operational noise.  
Helper action: Restrict direct notification creation to admin/system code and move scheduled checks to an authenticated cron route with idempotency.

### AUTH-007 - Login has no brute-force controls

Severity: High  
Evidence: `src/actions/auth-actions.ts:15` to `src/actions/auth-actions.ts:40` verifies email/password and creates a session, but has no rate limit, lockout, audit record, or uniform timing strategy beyond bcrypt comparison when a user exists.  
Impact: Credential stuffing against the public login is cheap.  
Helper action: Add IP/account rate limiting, failed-login telemetry, and generic responses with similar timing for missing users.

### AUTH-008 - Password changes do not revoke existing sessions

Severity: High  
Evidence: `changePassword` updates `users.passwordHash` at `src/actions/auth-actions.ts:75` to `src/actions/auth-actions.ts:78` but does not delete existing sessions for the user. `resetSettingsUserPassword` does the same at `src/actions/settings-actions.ts:236` to `src/actions/settings-actions.ts:239`.  
Impact: A compromised browser session survives password rotation/reset.  
Helper action: Delete all sessions for that user after password changes, except optionally the current session for self-service changes.

### AUTH-009 - Temporary password generation uses `Math.random`

Severity: High  
Evidence: `src/actions/settings-actions.ts:32` creates temp passwords with `Math.random()` and `Date.now()`.  
Impact: Temporary passwords are predictable enough to violate account recovery expectations.  
Helper action: Use `crypto.randomBytes`/`crypto.randomUUID` or Web Crypto and enforce one-time password reset on next login.

## Server Actions, Validators, And Business Logic

### BL-001 - Quote status can be reopened after project conversion

Severity: Critical  
Evidence: `QUOTATION_STATUS_TRANSITIONS` allows `accepted -> draft` in `src/lib/validators/quotation.ts:58`. `updateQuotationStatus` does not check whether a project already exists for the quote before changing status at `src/actions/quotation-actions.ts:277` to `src/actions/quotation-actions.ts:312`.  
Impact: A converted quote can be reopened and edited while an existing project keeps the old `quotedTotal`, creating audit and billing mismatch.  
Helper action: Make accepted quotes immutable once linked to a project. Add a project-existence guard in `updateQuotationStatus` and `updateQuotation`.

### BL-002 - Converting a quotation to a project is not concurrency-safe

Severity: Critical  
Evidence: `convertQuotationToProject` checks `quotation.project` at `src/actions/project-actions.ts:220`, then inserts a project at `src/actions/project-actions.ts:246` to `src/actions/project-actions.ts:261`. The DB schema has no unique constraint on `projects.quotationId` in `src/lib/db/schema.ts:190`.  
Impact: Two concurrent requests can create two projects from the same accepted quotation.  
Helper action: Add a unique index/constraint on `projects.quotation_id` where not null, and run the check/insert inside a transaction.

### BL-003 - Project completion side effects are not idempotent

Severity: High  
Evidence: `applyProjectCompletion` updates status and immediately calls `finalizeCompletionSideEffects` at `src/actions/project-actions.ts:511` to `src/actions/project-actions.ts:522`. That seeds three default warranty alerts at `src/actions/project-actions.ts:124` to `src/actions/project-actions.ts:148`.  
Impact: Concurrent completion requests can duplicate warranty alerts and notifications.  
Helper action: Use a transaction with conditional update `where status != 'completed'`, and unique warranty keys per project/default alert type.

### BL-004 - Some exported read actions do not parse filters at runtime

Severity: High  
Evidence:

- `getCustomers` accepts `CustomerFilter` but does not call `customerFilterSchema.parse` in `src/actions/customer-actions.ts:16`.
- `getInventoryItems` accepts `InventoryFilter` but does not call `inventoryFilterSchema.parse` in `src/actions/inventory-actions.ts:19`.
- `getProjects` accepts `ProjectListFilter` but does not call `projectListFilterSchema.parse` in `src/actions/project-actions.ts:300`.

Impact: Server Action type annotations are not a security boundary. Malformed or oversized payloads can reach DB query builders.  
Helper action: Parse every exported action input with Zod, including filters, IDs, and pagination.

### BL-005 - UUID route/action parameters are not consistently validated

Severity: Medium  
Evidence: `getCustomer`, `getInventoryItem`, `getQuotation`, `getProject`, `deleteProjectCost`, `deleteProjectRemark`, and the PDF route use raw `id` strings directly in Drizzle predicates.  
Impact: Invalid IDs become DB errors, log noise, and inconsistent user-facing messages.  
Helper action: Add a shared `uuidSchema` parser at the start of each action/route.

### BL-006 - Scheduled notifications are not idempotent

Severity: High  
Evidence: `runScheduledNotificationChecks` inserts new notifications for every matching quote/alert every time it runs at `src/actions/notification-actions.ts:177`, `src/actions/notification-actions.ts:222`, and `src/actions/notification-actions.ts:234`. There is no sent-key, date-key, or uniqueness guard.  
Impact: Re-running the action floods users with duplicate alerts.  
Helper action: Add `notification_dedupe_key` or a separate `notification_events` table and upsert by event/date/user.

### BL-007 - Dashboard conversion rate formula is wrong for business reporting

Severity: Medium  
Evidence: `quotationConversionRate` divides accepted total by currently sent total in `src/actions/dashboard-actions.ts:175` to `src/actions/dashboard-actions.ts:178`.  
Impact: If sent quotes are later accepted, the denominator shrinks while numerator grows, producing misleading conversion rates above 100%.  
Helper action: Calculate accepted / all decided-or-sent quotes over a defined period.

### BL-008 - Customer and inventory list actions have no pagination

Severity: High  
Evidence: `getCustomers` loads all active customers at `src/actions/customer-actions.ts:35` and uses `items.length` at `src/actions/customer-actions.ts:40`. `getInventoryItems` loads all matching inventory at `src/actions/inventory-actions.ts:39` and uses `items.length` at `src/actions/inventory-actions.ts:44`.  
Impact: Daily use degrades as the database grows; mobile dashboard users pay for full-table fetches.  
Helper action: Add `limit`, `offset`/cursor, and separate count queries with strict max limits.

## Database And Performance

### DB-001 - Database client is initialized at module scope

Severity: Critical  
Evidence: `src/lib/db/index.ts:1` loads dotenv, `src/lib/db/index.ts:8` throws if `DATABASE_URL` is absent, and `src/lib/db/index.ts:12` initializes Neon/Drizzle at import time.  
Impact: Next build/static analysis can evaluate modules before runtime env is available. It also produces noisy dotenv output during page data collection.  
Helper action: Replace exported `db` singleton with lazy `getDb()` initialization. Do not call `dotenv.config()` from runtime app modules.

### DB-002 - Runtime app imports `.env.local`

Severity: High  
Evidence: `src/lib/db/index.ts:1` to `src/lib/db/index.ts:2` calls `config({ path: '.env.local' })`. Build output showed repeated dotenv injection logs during static page generation.  
Impact: Production/serverless runtime behavior becomes environment-file dependent and noisy. Vercel should provide env vars directly.  
Helper action: Keep dotenv usage only in CLI scripts like Drizzle config or seed scripts.

### DB-003 - Migrations lack operational indexes

Severity: High  
Evidence: `drizzle/migrations/0000_reflective_vanisher.sql` creates FKs and unique constraints but no indexes for common filters/joins such as `customers.is_archived`, `quotations.status`, `quotations.created_at`, `projects.status`, `projects.actual_completion`, `warranty_alerts.due_date`, `notifications.user_id/is_read`, and FK columns.  
Impact: Dashboard, notifications, search, and project list queries will degrade quickly.  
Helper action: Add indexes matching actual query patterns, especially composite indexes for `(user_id, is_read, created_at)`, `(status, created_at)`, and `(is_resolved, due_date)`.

### PERF-001 - Dashboard actions run many independent queries sequentially

Severity: High  
Evidence: `getDashboardStats` performs many awaits from `src/actions/dashboard-actions.ts:84` to `src/actions/dashboard-actions.ts:164`; `getDashboardPipeline` does the same from `src/actions/dashboard-actions.ts:205` to `src/actions/dashboard-actions.ts:244`; `getRecentActivity` runs four independent list queries from `src/actions/dashboard-actions.ts:295` to `src/actions/dashboard-actions.ts:338`.  
Impact: Dashboard first load latency is the sum of many DB round trips.  
Helper action: Use `Promise.all` for independent queries or consolidate with SQL CTEs/materialized views.

### PERF-002 - Client-side dashboard data fetching loses App Router SSR benefits

Severity: Medium  
Evidence: `src/app/(dashboard)/page.tsx:8` renders `DashboardPage`, a client component, and hooks fetch dashboard actions after hydration.  
Impact: Authenticated users see loading states instead of server-rendered dashboard data, and network waterfalls increase.  
Helper action: Fetch initial dashboard data in a Server Component and hydrate TanStack Query or pass initial props.

### PERF-003 - Server Actions are used as read APIs for React Query

Severity: Medium  
Evidence: Hooks import read Server Actions directly, for example `src/hooks/use-customers.ts:3`, `src/hooks/use-inventory.ts:3`, `src/hooks/use-projects.ts:3`, and `src/hooks/use-quotations.ts:3`.  
Impact: Reads go through Server Action RPC rather than cacheable route handlers or Server Components. This makes caching, observability, and HTTP semantics harder.  
Helper action: Prefer Server Components for initial reads and route handlers for client polling/search endpoints.

## PWA And Deployment

### PWA-001 - Manifest metadata points to the wrong URL

Severity: Critical  
Evidence: `src/app/layout.tsx:34` sets `manifest: '/manifest.json'`, while `pnpm build` reports the route as `/manifest.webmanifest`. The actual manifest is implemented in `src/app/manifest.ts`.  
Impact: Browsers may fail to discover the PWA manifest, breaking installability.  
Helper action: Change metadata to `/manifest.webmanifest` or confirm a real `/manifest.json` route exists.

### PWA-002 - Serwist and Turbopack dev workflow conflict

Severity: Medium  
Evidence: `next.config.ts:4` uses `@serwist/next`, `next.config.ts:11` enables Turbopack, and the production build warns that `@serwist/next` does not support `next dev --turbopack`.  
Impact: Local PWA behavior can differ from dev expectations. The warning also makes CI/build logs noisy.  
Helper action: Use `next dev --webpack`, migrate to a Turbopack-compatible Serwist setup, or configure Serwist to avoid unsupported dev mode warnings.

### DEPLOY-001 - Vercel build does not run database migrations

Severity: High  
Evidence: `vercel.json` only runs `pnpm typecheck && pnpm lint && pnpm build`. README instructs manual `pnpm drizzle-kit push`.  
Impact: Fresh deployments can compile successfully but fail at runtime if migrations were not applied.  
Helper action: Add a controlled migration step in CI/CD or document a mandatory pre-deploy migration workflow with rollback checks.

### DEPLOY-002 - `pnpm install --frozen-lockfile` is correct but package versions are aggressive

Severity: Medium  
Evidence: `package.json` uses `next@16.2.6`, `react@19.2.6`, and `typescript@^6.0.3`. The extra strict pass found declaration incompatibilities in Drizzle, Serwist, Radix, React PDF, and TypeScript DOM/WebWorker libs.  
Impact: Dependency upgrades can break strict builds unexpectedly.  
Helper action: Pin TypeScript exactly, run a scheduled dependency compatibility check, and isolate service-worker types.

## Error Handling And Observability

### ERR-001 - Error messages can leak internal details to users

Severity: Medium  
Evidence: `formatErrorMessage` returns `error.message` directly at `src/lib/utils/error.ts:46`, and `handleActionError` returns it to the client at `src/lib/utils/error.ts:80`.  
Impact: DB, auth, or infrastructure errors can reveal implementation details.  
Helper action: Log detailed errors server-side, return stable user-safe messages by error code.

### ERR-002 - Several actions swallow errors completely

Severity: Medium  
Evidence: `getCustomers`, `getInventoryItems`, `getInventoryItem`, and delete actions catch without logging at `src/actions/customer-actions.ts:43`, `src/actions/inventory-actions.ts:47`, `src/actions/inventory-actions.ts:67`, and similar locations.  
Impact: Production incidents become hard to diagnose.  
Helper action: Use the shared `handleActionError` everywhere with sanitized client messages.

### ERR-003 - Console logging exists in runtime paths

Severity: Low  
Evidence: Error boundaries and upload/PDF routes use `console.error`, and `src/lib/utils/error.ts:67` logs JSON to console. Seed script uses `console.log`, which is fine for CLI only.  
Impact: Console logs are acceptable on Vercel but lack structured metadata, request IDs, and severity fields.  
Helper action: Add a lightweight logger abstraction that includes context, user ID when available, action name, and request correlation.

## Client-Side UX And Daily Workflow Pain Points

### UX-001 - Temp password is exposed only in a toast

Severity: High  
Evidence: `src/app/(dashboard)/settings/components/user-management-tab.tsx:89` displays `Temp password: ...` in a toast.  
Impact: Admin can miss or lose the only copy. Toasts can also be captured in screenshots.  
Helper action: Show a one-time modal with copy button, expiration, and forced reset instructions.

### UX-002 - Login catches redirects as unexpected errors

Severity: Medium  
Evidence: `login` calls `redirect('/')` at `src/actions/auth-actions.ts:40`. The client `onSubmit` wraps it in `try/catch` at `src/app/(auth)/login/page.tsx:50` to `src/app/(auth)/login/page.tsx:60`.  
Impact: Depending on Next redirect handling, the catch path can show "An unexpected error occurred" during valid redirects.  
Helper action: Return a typed result and route on the client, or let a form action handle redirect without catching it as a generic error.

### UX-003 - Project detail uses non-null data before loading guard

Severity: Medium  
Evidence: `const p = proj!` is declared at `src/app/(dashboard)/projects/[id]/project-detail-shell.tsx:201` before loading/undefined returns at `src/app/(dashboard)/projects/[id]/project-detail-shell.tsx:223` to `src/app/(dashboard)/projects/[id]/project-detail-shell.tsx:245`.  
Impact: It currently relies on React Query behavior and memo ordering. A refactor can turn this into a crash.  
Helper action: Move all `proj`-dependent logic behind the loading/undefined guards or split the loaded view into a child component.

### UX-004 - Duplicate mojibake/encoding artifacts are visible in UI/docs

Severity: Low  
Evidence: Examples include `src/app/(auth)/login/page.tsx:185`, `src/app/(dashboard)/projects/[id]/project-detail-shell.tsx:81`, and several rendered strings around quote/project detail.  
Impact: The app looks unpolished and can confuse users.  
Helper action: Normalize files to UTF-8 and replace corrupted punctuation/icons with intentional strings or lucide icons.

## Testing Gaps

### TEST-001 - Business-critical authorization flows lack tests

Severity: High  
Evidence: Existing tests cover pricing only. No tests exercise settings permissions, project completion permissions, quote/project conversion, session invalidation, or notification dedupe.  
Impact: The highest-risk regressions are not protected.  
Helper action: Add server-action unit/integration tests with mocked auth/session and DB transaction tests for conversion/completion.

### TEST-002 - Deployment/PWA behavior is not tested

Severity: Medium  
Evidence: Build passes, but there is no test that the manifest URL resolves, service worker asset is emitted, upload route rejects bad files, or PDF route returns a valid PDF.  
Impact: PWA installability and production workflows can break while CI stays green.  
Helper action: Add smoke tests for `/manifest.webmanifest`, `/api/upload` auth/type/size, and `/quotations/[id]/pdf`.

## Prioritized Fix Plan

1. Fix critical security/business issues: seed password, signed/rotated sessions, settings admin gating, project completion permission, quote-project immutability, unique `projects.quotation_id`.
2. Fix deployment/PWA blockers: lazy DB initialization, remove runtime dotenv, correct manifest URL, add migration workflow.
3. Restore SSoT: central enum constants, settings keys, `ActionResponse`, currency formatting, policy constants.
4. Harden validation: Zod-parse every exported Server Action input and UUID route param.
5. Improve performance: add indexes, paginate customers/inventory, parallelize dashboard queries, SSR initial dashboard data.
6. Raise strictness: split service-worker tsconfig, remove unsafe casts/non-null assertions, enable missing compiler flags, add type-aware ESLint rules.
7. Add regression tests around permissions, conversion race/idempotency, PWA manifest, upload, and PDF.
