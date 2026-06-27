# 🔍 Comprehensive Repo-Wide Audit Report — BOB Solar

**Audited:** 2026-06-26 | **Commit:** 5be54ea | **Scope:** Full codebase

---

## 🔴 Critical (Immediate Action Required)

### C-1. Hardcoded Secrets in `.env.local` — Session Secret is Weak & Predictable
**File:** `.env.local:17`

```env
SESSION_SECRET=bobsolar-minlulin-mr.lawkaparla@gmail.com-session-secret-random-value-2026
```

The session secret contains identifiable information (email, name, project name) and is not a cryptographically random value. Iron-session uses this to AES-256-GCM encrypt session cookies — a weak/predictable secret means an attacker who guesses it can forge session cookies, impersonate any user, and bypass all auth.

**Fix:** Generate with `openssl rand -base64 48` and replace. Rotate immediately.

### C-2. Hardcoded Database Credentials with Real Password in `.env.local`
**File:** `.env.local:5-11`

```env
DATABASE_URL=postgresql://neondb_owner:npg_g0qFQRd3Sexw@...
```

Real Neon database password `npg_g0qFQRd3Sexw` is in plaintext. While `.env.local` is in `.gitignore`, this file is present on disk. If the machine is compromised or the file is accidentally committed, full DB access is exposed.

**Fix:** Rotate the Neon password. Consider using a secrets manager or Vercel environment variables exclusively.

### C-3. Hardcoded Blob Storage Token in `.env.local`
**File:** `.env.local:14`

```env
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_K3ZIwuXopFNjfLer_kxIlx8FCMLQtwwXeE3wCItPozKNLZ7"
```

Full read-write Vercel Blob token. An attacker with this token can upload/replace/delete ANY stored file (logos, backups).

**Fix:** Rotate the token. Never store in local env files for production work — use Vercel platform secrets.

### C-4. Seed Admin Password in `.env.local`
**File:** `.env.local:20`

```env
SEED_ADMIN_PASSWORD='09500r500@'
```

Only 10 chars, no uppercase, no special chars beyond `@` — fails the app's own 12-char password policy (passwordValidationSchema in auth.ts). If this password was actually used to seed the DB, the admin account has a non-compliant password.

**Fix:** Replace with a password that meets the 12+ char, uppercase, lowercase, digit, special-char requirements. Re-seed or update the admin user's password.

---

## 🟠 High (Security & Correctness Issues)

### H-1. `deleteBackup` Has No URL Validation — Open Blob Delete
**File:** `src/actions/backup-actions.ts:316-327`

```typescript
export async function deleteBackup(url: string): Promise<ActionResponse<null>> {
  await requireAdmin();
  const token = requireBlobToken();
  await del(url, { token });  // ← No URL validation!
}
```

Unlike the download route which validates the URL is in the `backups/` folder and ends with `.json`, `deleteBackup` passes the raw `url` string directly to Vercel Blob's `del()`. An admin could delete ANY blob (logos, uploads, etc.) by passing a non-backup URL.

**Fix:** Add the same URL validation as `backup/download/route.ts` (parse URL, verify path starts with `backups/`, ends with `.json`).

### H-2. Backup Password Hashes are Exposed in Backup JSON
**File:** `src/actions/backup-actions.ts:200-218`

The backup serializes ALL rows from users table, including `password_hash`. The backup JSON stored in Vercel Blob is "private" but:
- Any admin with download access gets all password hashes
- If the blob storage is misconfigured or the token leaks, hashes are exposed
- No encryption-at-rest on the backup file itself

**Fix:** Either exclude `password_hash` from backups or encrypt the backup before upload.

### H-3. CSRF Bypassed in Development — CSRF Protection Disabled in Non-Production
**File:** `src/lib/security/csrf.ts:67-69`

```typescript
if (process.env.NODE_ENV !== "production") {
  return handler(req);  // ← Skip CSRF entirely in dev
}
```

And in upload route: `src/app/api/upload/route.ts:141-143` — the origin check is done inline but also only meaningful when both origin and referer are present.

**Risk:** In staging/preview environments that set `NODE_ENV !== "production"`, CSRF is fully bypassed. A staging URL accessible to attackers would have no CSRF protection.

**Fix:** At minimum, validate origin in all non-local environments. Consider a whitelist of allowed origins.

### H-4. `assertSessionSecretAtStartup` Only Validates in Production
**File:** `src/lib/auth/session.ts:58-62`

```typescript
export function assertSessionSecretAtStartup(): void {
  if (process.env.NODE_ENV === "production") {
    assertSessionSecret();
  }
}
```

In development/staging/preview, no validation occurs. Combined with the weak secret in `.env.local`, this means the app silently runs with an insecure session configuration outside production.

**Fix:** Always validate, or at minimum warn with `console.warn` when the secret is missing or too short in non-production.

### H-5. `isSealedSession` Only Checks `admin | owner` — Missing `technician` Role
**File:** `src/lib/auth/session.ts:100`

```typescript
(v["role"] === "admin" || v["role"] === "owner")
```

The `userRoleEnum` has three values: `admin`, `owner`, `technician`. The session type guard rejects any session with role: `"technician"`. If a technician user logs in, the session will be created but immediately treated as invalid on the next request.

**Fix:** Add `v["role"] === "technician"` to the type guard, or use a set/dynamic check against the enum values:

```typescript
const VALID_ROLES = new Set(userRoleEnum.enumValues) as Set<string>;
return typeof v["role"] === "string" && VALID_ROLES.has(v["role"]);
```

### H-6. Destructive DB Scripts Without Confirmation or Environment Guard
**File:** `scripts/db-nuke.ts:20-25`

```typescript
await c.query("DROP SCHEMA IF EXISTS public CASCADE");
await c.query("DROP SCHEMA IF EXISTS drizzle CASCADE");
```

No confirmation prompt. No check for `NODE_ENV === "production"`. Running this against a production database (if `DATABASE_URL` points to prod) drops everything irreversibly.

**File:** `scripts/_exec-drop.ts:30-48` — Same: drops all tables and enums without checks.

**Fix:** Add `--confirm` flag check (like `db-reset.ts` already does), refuse to run if `DATABASE_URL` contains certain production indicators, or require an explicit `--force` flag.

### H-7. `createQuotation`/`duplicateQuotation` Use `requireAuth()` Instead of `requireOwner()`
**File:** `src/actions/quotation-actions.ts:217`

```typescript
const auth = await requireAuth();  // ← Any authenticated user (incl. technician) can create quotations
```

The `requireAuth()` call allows any role including technician to create quotations. While there's a discount cap for non-admin, there's no restriction preventing technicians from creating high-value quotations.

**Fix:** Use `requireOwner()` for create/update/delete operations to restrict to admin + owner roles.

### H-8. `_quotationWithCustomerQuery` Return Type Mismatch
**File:** `src/actions/quotation-actions.ts:36-43`

```typescript
function _quotationWithCustomerQuery() {
  return db.query.quotations.findFirst({
    with: {
      customer: { columns: { name: true } },
      createdBy: { columns: { name: true } },
    },
  });
}
```

This function is called without any `where` clause. It always returns the first quotation in the database. The type `QuotationWithCustomer` derived from it is correct, but the function itself is a dangerous footgun — it always fetches a random quotation. It's only used for the type inference, but the function could accidentally be called directly.

**Fix:** Remove the function body or mark it `@internal` / underscore-prefixed to prevent accidental invocation. Or make it accept a `where` parameter.

### H-9. `pg_try_advisory_xact_lock` vs `pg_try_advisory_lock` Semantic Mismatch
**File:** `src/lib/utils/advisory-lock.ts:38`

```typescript
sql`SELECT pg_try_advisory_xact_lock(${this.key}::int8) AS "locked"`
```

The code uses `pg_try_advisory_xact_lock` (transaction-level lock), but the JSDoc and comments reference `pg_try_advisory_lock` (session-level lock). Transaction-level locks are automatically released at COMMIT/ABORT, which is actually the correct behavior here. However, the misleading documentation could cause future developers to make wrong assumptions.

**Fix:** Update JSDoc to correctly describe `pg_try_advisory_xact_lock` semantics — auto-released on transaction commit/rollback, no explicit `release()` needed.

### H-10. `AdvisoryLock` Has a `release()` Method That Does Nothing
**File:** `src/lib/utils/advisory-lock.ts`

The `release()` method is referenced in JSDoc usage example but doesn't actually exist in the class (only `acquire()` is defined). If someone calls `lock.release()` following the documented pattern, it will throw `TypeError: lock.release is not a function`.

**Fix:** Either implement `release()` (using `pg_advisory_unlock_all` or `pg_advisory_xact_lock` unlock) or remove it from the JSDoc example since `xact_lock` auto-releases on transaction end.

---

## 🟡 Medium (Correctness & Quality Issues)

### M-1. Financial Floating-Point Precision in `pricing/engine.ts`
**File:** `src/lib/pricing/engine.ts:24-27`

```typescript
const basePrice = quantity * unitPrice;
const discount = basePrice * (discountPercentage / 100);
return basePrice - discount;
```

JavaScript floating-point arithmetic can produce rounding errors (e.g., `0.1 * 3 = 0.30000000000000004`). While the final `Math.round()` in `calculateLineItem` helps, intermediate calculations can accumulate errors. The DB stores `DECIMAL(15,2)` but the JS math is floating-point.

**Fix:** Consider using integer arithmetic (calculate in cents/kyat) or a decimal library for the intermediate steps. At minimum, round at each step rather than only at the end.

### M-2. `calculateLineItem` Rounds to Nearest Integer — Loses Cents
**File:** `src/lib/pricing/engine.ts:20`

```typescript
export function calculateLineItem(item: LineItem): number {
  return Math.round(calculateLineItemPrecise(item));
}
```

`Math.round()` rounds to the nearest integer, losing all decimal precision. For a line item of quantity 1 × unit price 150.50, this rounds to 151 or 150. For a business app dealing with money, this is incorrect.

**Fix:** Round to 2 decimal places: `Math.round(value * 100) / 100`.

### M-3. `updateInventoryItem` Uses `Record<string, unknown>` Bypass
**File:** `src/actions/inventory-actions.ts:157-168`

```typescript
const dbUpdateData: Record<string, unknown> = { ...updateData, ... };
// ...then:
await db.update(inventoryItems).set({ ...dbUpdateData, updatedAt: new Date() })
```

Using `Record<string, unknown>` bypasses Drizzle's type safety. If a key in `updateData` doesn't match a column, it could cause a runtime DB error or silently include unwanted fields.

**Fix:** Explicitly map validated fields to the Drizzle update shape instead of spreading a generic record.

### M-4. `.env.example` Missing `DATABASE_URL_DIRECT` and `TEST_DATABASE_URL_DIRECT`
**File:** `.env.example`

The example env file doesn't include `DATABASE_URL_DIRECT`, `TEST_DATABASE_URL`, or `TEST_DATABASE_URL_DIRECT` which are required by `drizzle.config.ts` and `drizzle.test.config.ts`. New developers will get cryptic errors.

**Fix:** Add documented placeholders for all four database URLs.

### M-5. CI Workflow pnpm Version Mismatch
**File:** `.github/workflows/main.yml:33` and `main.yml:73`

```yaml
version: 11.1.0
```

But `package.json:5` specifies:

```json
"packageManager": "pnpm@11.5.2"
```

The CI uses pnpm 11.1.0 while the project requires 11.5.2. This version mismatch can cause lockfile incompatibility, install failures, or subtle behavioral differences.

**Fix:** Update the workflow to `version: 11.5.2` to match `packageManager`.

### M-6. CI Workflow Node.js Version vs `engines` Mismatch
**File:** `.github/workflows/main.yml:39` and `main.yml:78`

```yaml
node-version: '20'
```

But `package.json:7`:

```json
"engines": { "node": ">=24 <26" }
```

CI uses Node 20, but `engines` requires Node >=24. The CI will either fail the engines check or run with an unsupported Node version.

**Fix:** Update CI to `node-version: '24'`.

### M-7. `notifyAllUsers` Includes Archived Users
**File:** `src/lib/notifications/broadcast.ts:41`

```typescript
const allUsers = await db.select({ id: users.id }).from(users);
```

This selects ALL users including soft-archived ones (`archivedAt !== null`). Archived users shouldn't receive notifications.

**Fix:** Add `.where(eq(users.archivedAt, null))` or `isNull(users.archivedAt)`.

### M-8. `toAuditAction` Maps Unknown Events to "login" — Corrupts Audit Trail
**File:** `src/lib/security/audit.ts:37-41`

```typescript
default:
  return "login"; // ← Maps csrf_blocked, rate_limit_hit, quota_exceeded to "login"
```

Security events like `csrf_blocked`, `rate_limit_hit`, and `quota_exceeded` are stored in the audit log with action: `"login"`, making the audit data misleading. Filtering audit logs for actual login events will include CSRF blocks and rate limit hits.

**Fix:** Either extend the `audit_action` enum to include these events, or use a generic `"security_event"` enum value for unmapped types.

### M-9. `handleActionError` Leaks Error Details in Development
**File:** `src/lib/utils/error.ts:143-146`

```typescript
const message =
  process.env.NODE_ENV === "development"
    ? formatErrorChain(error, fallbackMessage)  // ← Full error chain with DB details
    : formatErrorMessage(error, fallbackMessage);
```

In development, the full error chain (which can include SQL queries, connection strings, internal Postgres errors) is returned to the client. If staging/preview uses `NODE_ENV=development`, this leaks sensitive DB info.

**Fix:** Consider returning the detailed message only in local development (check both `NODE_ENV` and hostname). In shared non-prod environments, use the safe format.

### M-10. `vitest.config.mts` Falls Back to Production `DATABASE_URL`
**File:** `vitest.config.mts:25`

```typescript
DATABASE_URL: process.env["TEST_DATABASE_URL"] ?? process.env["DATABASE_URL"] ?? "",
```

If `TEST_DATABASE_URL` is not set, tests run against the production/main database. This could truncate or corrupt production data.

**Fix:** Remove the fallback. If `TEST_DATABASE_URL` is missing, tests should fail fast with a clear error.

### M-11. `loginSchema` Trims Password — Breaks Passwords with Leading/Trailing Spaces
**File:** `src/lib/validators/auth.ts:5`

```typescript
password: z.string().trim().min(1, "Password is required"),
```

`.trim()` strips whitespace from the password. If a user has a password with leading/trailing spaces, they can never log in.

**Fix:** Remove `.trim()` from the password field. Passwords should be compared verbatim.

### M-12. `restoreQuotation` Allows Restoring Any Status
**File:** `src/actions/quotation-actions.ts:807-830`

```typescript
export async function restoreQuotation(id: string) {
  // ... no status check before restoring
  await db.update(quotations).set({ isArchived: false, archivedAt: null, ... })
}
```

Unlike `archiveQuotation` which only allows archiving rejected quotations, `restoreQuotation` can un-archive quotations of any status, including expired, accepted, or draft quotations that were archived for a reason.

**Fix:** Add a status check or at minimum verify `isArchived === true` before restoring.

### M-13. `deleteQuotation` is Actually Archive (Soft Delete) — Misleading Name
**File:** `src/actions/quotation-actions.ts:743-777`

```typescript
export async function deleteQuotation(id: string) {
  // ... sets isArchived: true instead of actually deleting
}
```

The function name says "delete" but it archives. This naming inconsistency could confuse developers who expect hard delete behavior.

**Fix:** Rename to `archiveQuotationAsDeleted` or similar, or implement actual deletion if that's the intent.

### M-14. `changePassword` Uses `getSessionFromCookie()` Instead of `requireAuth()`
**File:** `src/actions/auth-actions.ts:142`

```typescript
const session = await getSessionFromCookie();
if (!session) return errorResponse("Unauthorized");
```

This bypasses the full auth pipeline — no session version check (revocation), no archive check. A user with a revoked session could still change their password.

**Fix:** Use `requireAuth()` which checks session version, archive status, and DB role.

### M-15. `idempotencyKeys` Table Never Cleaned Up Proactively
**File:** `src/lib/utils/idempotency.ts:22-24`

```typescript
async function cleanupExpiredKeys() {
  const cutoff = new Date(Date.now() - IDEMPOTENCY_TTL_MS);
  await db.delete(idempotencyKeys).where(sql`${idempotencyKeys.createdAt} < ${cutoff}`);
}
```

Cleanup only runs after a successful idempotent write. Low-traffic apps will accumulate stale keys. The table has no automatic scheduled cleanup.

**Fix:** Add a Vercel Cron job or schedule cleanup independently.

---

## 🟢 Low (Minor Issues & Improvements)

### L-1. Duplicate ESLint and Biome Linting — Potential Conflict
**Files:** `biome.json` + `eslint.config.mjs`

Both biome and eslint are configured and run in the lint script. Biome has `noExplicitAny: "error"` and `noNonNullAssertion: "error"`, while ESLint has a single `no-restricted-syntax` rule. Having two linters can cause conflicting rules and slower CI.

**Fix:** Consider consolidating to a single linter. If both are needed, document which rules each is responsible for.

### L-2. `e2e/helpers.ts` Hardcoded Default Credentials
**File:** `e2e/helpers.ts:17-18`

```typescript
const email = process.env["SEED_ADMIN_EMAIL"] ?? "admin";
const password = process.env["SEED_ADMIN_PASSWORD"] ?? "admin123456!@";
```

Fallback credentials `admin/admin123456!@` could be used in CI if env vars are missing. The password `admin123456!@` is only 12 chars and highly predictable.

**Fix:** Require env vars and throw if missing instead of using defaults.

### L-3. E2E Tests Use `waitForTimeout()` — Flaky Pattern
**File:** `e2e/dashboard.spec.ts:50,68`

```typescript
await page.waitForTimeout(500);
await page.waitForTimeout(300);
```

Hard-coded sleeps are inherently flaky. They may be too short on slow CI or unnecessarily slow on fast machines.

**Fix:** Replace with `waitFor` on a specific element or condition.

### L-4. E2E Tests Have Tautological Assertions
**File:** `e2e/dashboard.spec.ts:26,36,76`

```typescript
expect(hasNav).toBeGreaterThanOrEqual(0);  // ← Always passes
```

`count()` returns 0 or more, so `>= 0` always passes regardless of UI state.

**Fix:** Use `expect(hasNav).toBeGreaterThan(0)` or `expect(nav).toBeVisible()`.

### L-5. E2E Tests Create Data Without Cleanup
**Files:** `e2e/customers.spec.ts`, `e2e/quotations.spec.ts`

Tests create customer/quotation records but don't clean up in `afterEach`. Repeated runs accumulate test data.

**Fix:** Add cleanup in `afterEach` hooks.

### L-6. `companySettings` Table Has No Size Limit
**File:** `src/lib/db/schema.ts:453-457`

```typescript
export const companySettings = pgTable("company_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
```

The `value` field is unbounded `text()`. No validation on write could allow storing arbitrarily large values.

**Fix:** Add a Zod schema with max length for company settings values.

### L-7. health API Route is Unauthenticated
**File:** `src/app/api/health/route.ts`

The health check requires no auth and exposes DB latency. While useful for monitoring, it also confirms DB connectivity to unauthenticated callers.

**Fix:** Acceptable for health checks, but consider rate-limiting or restricting to internal IPs.

### L-8. Service Worker `skipWaiting: true` and `clientsClaim: true`
**File:** `src/sw.ts:22-23`

```typescript
skipWaiting: true,
clientsClaim: true,
```

This means a new SW immediately takes control, potentially breaking in-flight requests. While common, it can cause issues if the new SW has breaking cache changes.

**Fix:** Consider using a safer activation strategy for production, or ensure thorough testing of SW updates.

### L-9. `pnpm-workspace.yaml` is Empty/Single-Package
**File:** `pnpm-workspace.yaml`

A workspace file exists but the project is a single package. This is harmless but unnecessary.

**Fix:** Remove if not using workspaces.

### L-10. `biome.json` `useLiteralKeys: "off"` May Hide Debugging Info
**File:** `biome.json:29`

Turning off `useLiteralKeys` means `obj["key"]` and `obj.key` are both accepted, reducing code style consistency.

**Fix:** Enable the rule for consistency.

---

## 📊 Summary

| Severity | Count | Key Areas |
|----------|-------|-----------|
| 🔴 Critical | 4 | Hardcoded secrets, weak session key, seed password policy violation |
| 🟠 High | 10 | Missing auth checks, URL validation, CSRF bypass, technician role bug, misleading docs |
| 🟡 Medium | 15 | Floating-point money, CI version mismatches, audit trail corruption, dev error leaks |
| 🟢 Low | 10 | Flaky tests, tautological assertions, lint duplication, SW activation |

### Top 5 Priority Fixes:
1. Rotate `SESSION_SECRET` to a cryptographically random value (C-1)
2. Fix `isSealedSession` type guard to include technician role (H-5)
3. Add URL validation to `deleteBackup` (H-1)
4. Fix CI pnpm and Node.js versions to match `package.json` (M-5, M-6)
5. Fix `calculateLineItem` rounding to 2 decimal places instead of integer (M-2)