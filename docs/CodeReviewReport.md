# BOB Solar — Comprehensive Code Review Report

**Repository:** `C:\bobsolar` (Next.js 16 App Router + Drizzle ORM + Neon Postgres)  
**Reviewed:** ~529 source files across config, schema, actions, lib, hooks, components, and routes.

---

## Executive Summary

This is a mature, well-architected codebase with strong security fundamentals: stateless iron-session auth with session-version revocation, a clear SSoT canonical structure, centralized policy constants, Zod validation on every action, and thoughtful DB-level constraints. The overall quality is high. The issues below are real but none are show-stoppers; most are medium/low severity hardening items, with a handful of correctness bugs worth fixing soon.

---

## Strengths

- **Security-first auth design** — Stateless iron-session with `session_version` revocation, uniform-timing password verification with a dummy hash, sliding-window rate limiting with atomic upserts, and `AUTH_MIN_RESPONSE_MS` to defeat timing attacks. (`src/lib/auth/session.ts`, `src/actions/auth-actions.ts`)
- **Strong SSoT discipline** — Enums live in `src/lib/db/schema.ts`, values/labels/guards in `src/lib/domain/*`, Zod schemas in `src/lib/validators/*`, and an ESLint rule (`eslint.config.mjs:17-25`) that actively forbids inferring enum types locally.
- **DB-level data integrity** — `CHECK` constraints on non-negative stock, single-sided journal lines, owner slots, plus unique partial indexes and notification dedupe. (`schema.ts:249`, `749-753`, `833`)
- **Clean layered architecture** — `domain → validators → actions → hooks → components` with no business literals leaking into components, and a centralized `query-keys.ts` factory.
- **Excellent error sanitization** — `handleActionError` only exposes the full error chain on local dev; staging/preview/production get safe messages, preventing DB connection strings / SQL from leaking. (`src/lib/utils/error.ts:147-154`)

---

## Critical / High Severity Issues

### 1. Open backup download — path-traversal-style read via attacker-controlled URL

| Field | Value |
|-------|-------|
| **File** | `src/app/api/backup/download/route.ts:34-75` |
| **Severity** | High |

The route validates that the URL path starts with `backups/` and ends in `.json`, but the actual blob is fetched with an attacker-supplied full URL (`searchParams.get("url")` → `get(blobUrl, ...)`). An admin who can be tricked into clicking a crafted link, or any XSS, could be induced to fetch and exfiltrate any blob the token can read. More importantly, the validation only checks `pathParts[0]` — a URL like `https://evil.com/backups/x.json` passes the `.endsWith(".json")` check only if host ends in `.json`, but the `get()` call still goes to the host in the URL. The `get` from `@vercel/blob` may follow the URL to an arbitrary host.

**Fix:** Parse out only the pathname/key, validate it against a strict pattern (e.g. `backups/<uuid>.json`), and reconstruct the blob URL from a known store prefix rather than trusting the input URL. Return the stream through an authenticated response rather than letting the client supply the origin.

---

### 2. Upload rate-limiter logic bug — window never resets, lock semantics inverted

| Field | Value |
|-------|-------|
| **File** | `src/app/api/upload/route.ts:77-132` |
| **Severity** | High (correctness) |

`isRateLimited` sets `lockedUntil = now + WINDOW` on the first attempt and treats it as the window end. But the check `existing.lockedUntil <= now` (line 87) conflates "window expired" with "not locked." On the first request it inserts `attempts: 1`, `lockedUntil: now+60s`. For the next 60s, every request increments `attempts` and returns `false` (not limited) until `attempts >= 12`, at which point it returns `true` — but `lockedUntil` is never extended, so after the original 60s the next request resets to `attempts: 1` via the `existing.lockedUntil <= now` branch. The intent (12 requests per 60s window) is roughly honored, but the `lockedUntil` field is misleading and the reset path re-inserts `attempts: 1` rather than incrementing.

**Fix:** Align with the proven `onConflictDoUpdate` pattern used in `auth-actions.ts:71-92`.

---

### 3. `withCsrf` is defined but unused — upload route hand-rolls CSRF

| Field | Value |
|-------|-------|
| **File** | `src/lib/security/csrf.ts` (defined) vs `src/app/api/upload/route.ts:136-164` (hand-rolled) |
| **Severity** | Medium-High |

The upload route duplicates origin/referer checking inline instead of using the existing `withCsrf` helper. Worse, `withCsrf` itself (line 67-69) skips the check entirely in non-production, and the upload route's inline check runs in all environments but has a subtle flaw: when `origin` is absent it falls back to `referer`, but a browser that sends neither (privacy mode, some proxies) gets a `403` even for legitimate same-origin requests. The `withCsrf` helper returns `false` (blocks) when no origin is present — same issue.

**Fix:** Use `withCsrf` everywhere, and make the "no header" case configurable (fail-open in dev with a log, fail-closed in prod).

---

## Medium Severity Issues

### 4. Audit enum overflow — `csrf_blocked`, `rate_limit_hit`, `quota_exceeded` silently stored as `session_revoke`

| Field | Value |
|-------|-------|
| **File** | `src/lib/security/audit.ts:27-43` |
| **Severity** | Medium |

`toAuditAction` maps three distinct security events to the single DB enum value `session_revoke`. This corrupts audit analytics — a query for "session revocations" will be inflated by rate-limit and CSRF events, and the real reason is only discoverable by reading `details.eventType`. The schema's `audit_action` enum has only 4 values.

**Fix:** Either expand the `audit_action` enum (and add a migration) to include `csrf_blocked`, `rate_limit_hit`, `quota_exceeded`, or store these events in a separate `security_events` table.

---

### 5. `proxy.ts` is an open redirector via the `next` parameter

| Field | Value |
|-------|-------|
| **File** | `src/proxy.ts:60-64` |
| **Severity** | Medium |

`url.searchParams.set("next", pathname)` is fine (it's the current path), but the login page presumably redirects to `next` after auth. If the login handler doesn't validate that `next` is a relative path, an attacker can craft `?next=https://evil.com` for a post-login redirect (open redirect / token leakage via Referer).

**Fix:** Verify the login handler validates `next` starts with `/`.

---

### 6. `getToken()` scans all env vars for any `*_READ_WRITE_TOKEN`

| Field | Value |
|-------|-------|
| **File** | `src/lib/storage/blob.ts:10-16` |
| **Severity** | Medium |

The fallback loop returns the first env var ending in `_READ_WRITE_TOKEN`. If multiple blob stores are configured (or a similarly-named var exists), the wrong token could be used silently, causing auth failures against the wrong store or leaking data to the wrong bucket.

**Fix:** Prefer the explicit `BLOB_READ_WRITE_TOKEN` and only fall back to a documented, specific alternate key. Log which token was selected at init.

---

### 7. `sw.ts` excluded from ESLint and TS coverage

| Field | Value |
|-------|-------|
| **Files** | `eslint.config.mjs:9`, `tsconfig.json:59` |
| **Severity** | Medium |

`src/sw.ts` is excluded from both the TS program and ESLint. It uses `skipWaiting: true` + `clientsClaim: true` which, combined with the offline fallback, can cause a newly-claimed SW to serve stale app shells to existing tabs. This is a known footgun.

**Fix:** At minimum, the SW should be type-checked.

---

### 8. `unstable_cache` keyed only by filter tuple — no user/role scoping

| Field | Value |
|-------|-------|
| **File** | `src/actions/inventory-actions.ts:22-58` |
| **Severity** | Low-Medium |

`getCachedInventoryPage` is wrapped in `unstable_cache` with key `["inventory:list-page"]` plus the filter args. Since `unstable_cache` is process-wide, this is fine for shared data, but the cache is invalidated with `revalidateTag(..., "max")`.

**Fix:** Verify this is intentional and that no user-specific data ever flows through this cached path.

---

## Low Severity / Observations

### 9. AGENTS.md version drift

`AGENTS.md:17` says `pnpm@11.5.2` but `package.json:5` declares `pnpm@11.9.0`. The `packageManager` field and the doc disagree.

**Fix:** Update the doc.

### 10. Duplicate Zod versions in `node_modules`

Both `zod@4.4.1` and `zod@4.4.3` are present (transitive deps). This can cause `instanceof ZodError` checks to fail across package boundaries and inflates bundle size.

**Fix:** Pin a single version via `pnpm overrides`.

### 11. `changePassword` wraps a single `UPDATE` in a transaction unnecessarily

**File:** `src/actions/auth-actions.ts:178-183`

A single `UPDATE` is already atomic; the `db.transaction()` wrapper adds a round-trip with no benefit. The comment explains the atomicity concern, but one statement cannot partially succeed.

**Fix:** Remove the transaction wrapper or combine it with the audit-log insert if atomicity across both is desired.

### 12. `updateInventoryItem` builds a loosely-typed update object

**File:** `src/actions/inventory-actions.ts:157-175`

`dbUpdateData` is `Record<string, unknown>` and spread into `.set()`. This bypasses Drizzle's type safety and could silently write unexpected columns if the schema drifts.

**Fix:** Build the typed object explicitly.

### 13. `financeKeys` is empty

**File:** `src/lib/query-keys.ts:134-136`

`financeKeys` has only `all` with no `list`/`detail` factories. Either this is dead code to remove, or query keys are being constructed inline elsewhere (SSoT drift).

### 14. Health endpoint exposes DB latency and timestamp to unauthenticated callers

**File:** `src/app/api/health/route.ts`

Fine for a liveness probe, but ensure this route isn't a timing oracle.

**Fix:** Consider gating behind a token if it reports degraded.

### 15. `proxy.ts` matcher comment is misleading

**File:** `src/proxy.ts:81-85`

Claims proxy "will still run for `_next/data/*` routes" and calls it intentional, but the matcher explicitly excludes `_next/data`. The comment contradicts the code.

**Fix:** Verify the actual behavior and fix the comment.

---

## Security Summary

| Concern | Status |
|---------|--------|
| Session management | Strong (stateless + revocation) |
| Password hashing | Strong (scrypt, timing-safe) |
| Auth rate limiting | Strong (atomic upsert) |
| Input validation | Strong (Zod on all actions) |
| Error leakage | Strong (env-gated) |
| CSRF | Medium (helper exists but unused; dev bypass) |
| Backup download auth | **High risk** (attacker-supplied URL) |
| Blob token selection | Medium (scans all env vars) |
| Hardcoded secrets | None found in `src/` |
| SQL injection | None (parameterized via Drizzle) |
| XSS | Low risk (React escapes by default; PDF components use `html-escape.ts`) |

---

## Recommended Priority Order

1. **Fix backup download URL validation** (High — data exfiltration path)
2. **Unify CSRF handling via `withCsrf`**, fix the no-header case (Medium-High)
3. **Expand audit enum or split security events** (Medium)
4. **Fix upload rate-limiter** to match the proven auth pattern (Medium)
5. **Validate `next` param in login** to prevent open redirect (Medium)
6. **Pin single Zod version** via `pnpm overrides` (Low)
7. **Type-check `sw.ts`** and remove from eslint/ts exclude lists (Low)
8. **Clean up** `financeKeys`, `updateInventoryItem` typing, `changePassword` transaction, AGENTS.md version

---

The codebase is in genuinely good shape — the architecture, SSoT discipline, and security fundamentals are well above average. The issues above are refinements rather than structural problems.
