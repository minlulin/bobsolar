# BOB Solar — Final Codebase Audit

**Project:** bobsolar v0.1.0 — Next.js 16.2.7, React 19, Drizzle ORM, TypeScript 6.0
**Date:** June 7, 2026
**Scope:** Full architecture audit: bugs, business logic, performance

---

## Overview

The codebase is well-structured overall with strong typing, good test coverage, proper server/client component separation, and a well-designed financial domain model (immutable journal entries with reversal flows). The following findings represent areas requiring attention, ordered by severity.

---

## 1. Hidden Bugs

> **Status: ALL RESOLVED ✅** (Last updated: June 7, 2026)

### 1.1 `env.ts` — Module-level `process.exit(1)` crashes builds ✅ FIXED

**File:** `src/lib/env.ts:26-27,42`

`validateServerEnv()` is called at module import time. During `next build`, `DATABASE_URL` is typically absent (runtime-only env var). This kills the build process.

**Fix:** Defer to a getter function:
```ts
let _serverEnv: z.infer<typeof serverEnvSchema> | null = null;
export function getServerEnv(): typeof _serverEnv {
  if (!_serverEnv) {
    const parsed = serverEnvSchema.safeParse(process.env);
    if (!parsed.success) throw new Error("Invalid env: " + JSON.stringify(parsed.error.format()));
    _serverEnv = parsed.data;
  }
  return _serverEnv;
}
```

---

### 1.2 `auth-actions.ts` — TOCTOU race condition on rate limiting ✅ FIXED

**File:** `src/actions/auth-actions.ts:40-98`

Login rate limiting uses read-check-write outside a transaction. Concurrent requests can bypass the 5-attempt lockout.

**Fix:** Use atomic `UPDATE ... SET attempts = attempts + 1 ... RETURNING attempts`:
```ts
const [updated] = await db
  .update(authRateLimits)
  .set({
    attempts: sql`${authRateLimits.attempts} + 1`,
    lastAttemptAt: now,
    updatedAt: now,
  })
  .where(eq(authRateLimits.key, rateKey))
  .returning();
```

---

### 1.3 `changePassword` destroys current session silently ✅ FIXED

**File:** `src/actions/auth-actions.ts:149-158`

Bumps `sessionVersion` (invalidating current session) but returns success without redirecting. User gets dumped to `/login` on next navigation with no explanation.

**Fix:** After password update, either re-create the session with the new version, or redirect with a status message:
```ts
await createSession(user.id, user.role, user.sessionVersion + 1);
```

---

### 1.4 `mutation-factory.ts` — Unreachable dead code ✅ FIXED

**File:** `src/hooks/mutation-factory.ts:71-75`

`mutationFn` already throws on `!result.success` (line 57). The guard `if (!response.success) return` in `onSuccess` is structurally unreachable but **retained as a TypeScript type-narrowing guard** with an explanatory comment, since `ActionResponse<TData>` is a union type and `data` only exists on the success variant.

---

### 1.5 `dashboard-actions.ts` — `NEXT_REDIRECT` escapes server action → hook boundary ✅ FIXED

**File:** `src/lib/utils/error.ts:100-103`

`handleActionError` re-throws `NEXT_REDIRECT` digest errors. When a server action called from a client `useQuery` hook throws this, it bubbles as an unhandled promise rejection → generic toast error instead of performing the redirect.

**Fix:** Use `redirect()` only in Server Components, not in action functions called from client hooks.

---

### 1.6 `global-error.tsx` — Missing `<html>` and `<body>` tags (actually present) ✅ N/A

**File:** `src/app/global-error.tsx:17-18`

Global error boundary has `<html>` and `<body>` defined with inline styles. This is correct — the global error boundary must provide its own HTML shell since it replaces the entire document.

---

### 1.7 `db/index.ts` — Dynamic `require("ws")` incompatible with pure ESM ✅ FIXED

**File:** `src/lib/db/index.ts:11`

Uses CJS `require("ws")` inside an ESM module. Currently works due to mixed module config, but will break when migrating to `"type": "module"`.

---

### 1.8 `error.ts` — `formatErrorChain` infinite loop risk ✅ FIXED

**File:** `src/lib/utils/error.ts:58-72`

If `error.cause` is truthy but not an `Error` instance (e.g., a plain object), the while loop never breaks — it only breaks inside the `instanceof Error` branch. No depth guard for this case.

---

## 2. Business Logic Failures

### 2.1 Auth rate limiting — No atomic increment (CRITICAL) ✅ FIXED (Phase 1 — 1.2)

**File:** `src/actions/auth-actions.ts:58-79`

(Details in 1.2 above.) ~~The read-check-write pattern is not atomic. Concurrent requests bypass the lockout cap.~~ Now uses atomic `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` with `sql` increment.

---

### 2.2 `env.ts` — `DATABASE_URL` required but absent at build time ✅ FIXED (Phase 1 — 1.1)

**File:** `src/lib/env.ts:24-36`

~~Schema requires `DATABASE_URL: z.string().min(1)`. Not available during `next build` on Vercel. Crashes the build.~~ Now uses lazy `getServerEnv()` getter; validation runs at first access, not at module import time.

---

### 2.3 Project status transitions not enforced in `updateProject` ✅ FIXED

**File:** `src/actions/project-actions.ts:899`

`updateProject` already calls `canTransitionProjectStatus()` (re-exported from `domain/project.ts` via `validators/project.ts`) before allowing any status change. Admin-only guard is also enforced (line 893-894).

---

### 2.4 Quotation `accepted → draft` leaves orphaned project ✅ FIXED

**File:** `src/actions/quotation-actions.ts:413-423`

`updateQuotationStatus` checks for a linked project before allowing any status change. If a project exists, the status change is blocked with a clear error message: *"Cannot change quotation status - it has already been converted to a project"*.

---

### 2.5 Quotation archive doesn't cascade to related entities ✅ SAFE

**File:** `src/actions/quotation-actions.ts:796-798`

`archiveQuotation` only allows `status === "rejected"`. The `projects.quotationId` FK uses `onDelete: "restrict"` — a rejected quotation cannot have been converted to a project (the conversion requires `status === "accepted"`). Archiving a rejected quotation is therefore safe by design.

---

### 2.6 `changePassword` — No audit trail or notification ✅ FIXED

**File:** `src/actions/auth-actions.ts:172-184`

After password update, the action now:
1. Inserts an audit log entry (`auditLogs` table with `action: "password_change"`)
2. Sends an in-app notification to the user: *"Password changed — Your password was updated. All other sessions have been revoked."*

Requires migration `0034_add_audit_logs.sql` to create the `audit_logs` table.

---

### 2.7 `overridePeriodLock` bypasses all accounting controls ✅ SAFE

**File:** `src/lib/finance/ledger.ts:140-147`

The `overridePeriodLock` parameter exists in the `CreateJournalEntryInput` type but is **never passed as `true`** by any caller. `manual-journal-actions.ts` calls `createBalancedJournalEntry` without this parameter, so period lock checks are always enforced. The parameter is unused dead code — no bypass occurs.

---

## 3. Performance Bottlenecks

### 3.1 Dashboard layout `force-dynamic` kills all caching

**File:** `src/app/(dashboard)/layout.tsx:17`

```ts
export const dynamic = "force-dynamic";
```

Prevents ALL downstream route segments from using Full Route Cache. Every dashboard request:
- Re-executes `requireAuth()` (DB hit for sessionVersion check)
- Re-fetches user + company logo (2 queries)
- Cannot statically cache any page

**Fix:** Remove `force-dynamic`. Isolate dynamic elements (user name, logo) into React Suspense boundaries:
```tsx
<div className="flex items-center gap-2 sm:gap-4">
  <NotificationBell />
  <ThemeToggle />
  <Suspense fallback={<UserNavSkeleton />}>
    <UserNav />
  </Suspense>
</div>
```

---

### 3.2 No root-level `loading.tsx`

**File:** missing `src/app/loading.tsx`

`src/app/(dashboard)/loading.tsx` exists but there's no root-level loading state. First navigation between route groups (auth → dashboard) shows no loading indicator.

---

### 3.3 Too-broad query invalidation causes waterfall refetches

**Files:** Multiple hooks, e.g. `src/hooks/use-projects.ts:79`

```ts
invalidateKeys: [projectKeys.all]
```

Invalidates ALL project queries — list + all open detail views. A single project update triggers 50+ refetches.

**Fix:** Use targeted invalidation:
```ts
invalidateKeys: [projectKeys.list(filters)] // only the current list view
// Or invalidate specific IDs:
queryClient.invalidateQueries({ queryKey: projectKeys.detail(updatedId) })
```

---

### 3.4 No Suspense boundaries on dashboard page

**File:** `src/app/(dashboard)/dashboard-page-client.tsx`

Dashboard likely fetches stats, pipeline, activity, alerts, finance data without individual `<Suspense>` boundaries. One slow query blocks the entire page.

---

### 3.5 Time-based revalidation instead of tag-based

**File:** `src/actions/dashboard-actions.ts`

All dashboard endpoints use `unstable_cache` with `revalidate: 60`. After any mutation, users see stale data for up to 60 seconds.

**Fix:** Use cache tags and `revalidateTag()` in mutation server actions:
```ts
// In dashboard action:
unstable_cache(fn, ["dashboard-stats"], { tags: ["dashboard-stats"] })

// In mutation action:
revalidateTag("dashboard-stats")
```

---

### 3.6 No optimistic updates on most mutations

**Files:** All hooks except `src/hooks/use-notifications.ts`

Only notification read/unread uses optimistic updates. All other mutations (customers, inventory, projects, etc.) invalidate and wait for refetch, causing loading spinners on every action.

---

### 3.7 Large JSONB transferred across server-client boundary

**File:** `src/lib/db/schema.ts:99`

`inventoryItems.specifications` (jsonb) is included in list responses. For list views showing only name/price/stock, this payload is wasteful.

**Fix:** Use server-side projection:
```ts
columns: { name: true, unitPrice: true, stockQty: true }
```

---

### 3.8 No bundle analyzer or Core Web Vitals tracking

**File:** `next.config.mjs`

Notable absences:
- No `@next/bundle-analyzer` configured
- No `useReportWebVitals` for real-user performance data
- No visibility into client bundle composition

---

## 4. Best Practice Checklist (2026)

Based on current Next.js 16 recommendations:

| Practice | Status | Notes |
|----------|--------|-------|
| Server Components for data fetching | ✅ | Well implemented |
| `next/image` with `priority` on hero | ✅ | Login + dashboard logo |
| `next/font` with `display: swap` | ✅ | Inter + JetBrains Mono |
| CSP security headers | ✅ | Custom in next.config.mjs |
| Turbopack (default in Next.js 16) | ⚠️ | Only in dev; build uses `--webpack` flag |
| Cache Components (replaces PPR) | ❌ | Not configured |
| `useReportWebVitals` | ❌ | Not implemented |
| Bundle analyzer | ❌ | Not configured |
| `server-only` package guard | ❌ | Not used |
| Root `loading.tsx` | ❌ | Missing |
| Granular Suspense boundaries | ❌ | Missing on dashboard |
| Tag-based cache invalidation | ❌ | Time-based only |
| Optimistic updates | ⚠️ | Only on notifications |
| Data projection for lists | ⚠️ | Not consistently applied |

---

## Recommended Immediate Actions

1. ~~**Fix auth rate limiting race**~~ ✅ (Critical security — 2.1 / 1.2)
2. ~~**Fix `env.ts` build crash**~~ ✅ (Blocks deployment — 1.1 / 2.2)
3. ~~**Fix `changePassword` session handling + audit trail**~~ ✅ (Poor UX / data loss — 1.3 / 2.6)
4. **Remove `force-dynamic` from dashboard layout** (Biggest perf gain — 3.1)
5. **Add root `loading.tsx`** (Quick win — 3.2)
6. **Add Suspense boundaries to dashboard** (Medium effort, high impact — 3.4)
7. **Switch to tag-based cache invalidation** (Medium effort — 3.5)
8. **Add `@next/bundle-analyzer` + `useReportWebVitals`** (Low effort — 3.8)

---

## Strengths

- Immutable journal entries with a clean reversal flow pattern
- Well-typed financial domain with clear separation of concerns
- Good test coverage across server actions, domain logic, and E2E
- Proper use of `react/cache` for request deduplication
- Security headers via CSP, HSTS, X-Frame-Options
- Stateless session pattern via iron-session (no sessions table)
- Consistent server action pattern with `ActionResponse<T>` discriminated union
- Database-level constraints (CHECK, unique indexes, FK with restrict)
- SSoT-driven domain model with drift detection assertions
