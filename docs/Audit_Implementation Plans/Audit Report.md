# ELITE Error Hunter Report — Injection & Auth Bypass Scan

**Date:** 2026-05-13  
**Scope requested:** `src` and `lib` only; tests/docs ignored.  
**Focus requested:** injection vulnerabilities and auth bypasses.  
**Change policy:** no production fixes applied; this file is a report with suggested fix plans only.

## Executive Summary

I found **three security-relevant issues** during the focused scan:

1. **High:** any authenticated user can create arbitrary notifications for arbitrary users, including unvalidated navigation links that are later passed into `router.push`.
2. **High:** inventory write operations are protected only by generic authentication even though the UI explicitly notes role gating is missing; the page currently passes `canEdit={true}`.
3. **Medium:** several operational mutations rely on UI-only affordances or broad `requireAuth()` gates, allowing non-admin users to invoke sensitive workflow transitions or scheduled maintenance actions directly.

I did **not** find direct raw-string SQL injection in the scanned paths. Drizzle parameter interpolation is used for observed SQL fragments, including `ilike` search and `sql\`... ${value} ...\`` expressions.

---

## Finding 1 — Arbitrary notification creation + unvalidated client navigation

**Severity:** High  
**Category:** auth bypass + client-side navigation injection / phishing vector  
**Affected files:**

- `src/actions/notification-actions.ts`
- `src/components/layout/notification-bell.tsx`

### Evidence

`createNotification` accepts `userIds`, `title`, `message`, `type`, `link`, and `dedupeKey` from untrusted callers. Its schema permits any optional string for `link`, and the function uses only `requireAuth()` rather than `requireAdmin()` or a scoped system-only capability.

The stored notification link is later consumed by the notification bell and passed directly to `router.push(notification.link)` if present.

### Root Cause

The server action exposes a high-trust broadcast primitive to every authenticated user. It does not enforce:

- sender authorization over target `userIds`,
- whether the caller may create system notifications,
- a safe internal-route-only URL policy,
- link allowlisting by domain/path,
- or validation that links begin with approved application paths such as `/quotations/`, `/projects/`, `/warranty`, etc.

### Impact

A low-privileged authenticated user can potentially:

- create notifications for other users,
- impersonate system workflow messages,
- inject arbitrary links into another user’s notification tray,
- trigger unsafe client-side navigation behavior depending on how Next.js handles malicious schemes in the runtime version,
- or phish users into attacker-controlled routes/URLs if external links are accepted by the router/runtime.

### Suggested Fix Plan

1. **Split internal and external notification creation.** Keep exported server actions user-scoped, and move system/broadcast creation into non-exported service functions callable only by trusted server code.
2. **Require admin or service authorization** for any action that targets arbitrary `userIds` or broadcasts to multiple users.
3. **Validate notification links with a strict route schema.** Prefer a tagged union, for example:
   - `{ kind: 'quotation'; id: UUID }`
   - `{ kind: 'project'; id: UUID }`
   - `{ kind: 'warranty' }`
     Then derive paths server-side instead of accepting a free-form `link` string.
4. If a string path must be accepted, require a **relative internal URL** beginning with `/`, reject `//`, reject backslashes/control chars, and reject any scheme such as `javascript:`, `data:`, `http:`, or `https:`.
5. Add security tests for unauthorized callers, cross-user targets, malicious schemes, and protocol-relative URLs.

---

## Finding 2 — Inventory write actions are authenticated but not role-authorized

**Severity:** High  
**Category:** auth bypass / missing object-operation authorization  
**Affected files:**

- `src/app/(dashboard)/inventory/page.tsx`
- `src/actions/inventory-actions.ts`

### Evidence

The inventory page renders every inventory card with `canEdit={true}` and a comment stating role checking should happen in a real app. Server-side inventory mutations (`createInventoryItem`, `updateInventoryItem`, `deleteInventoryItem`, and `bulkUpdatePrices`) call `requireAuth()` but do not require admin or inventory-manager authorization.

### Root Cause

Authorization is enforced as “logged in” instead of “allowed to mutate inventory”. The client UI also hardcodes edit capability, which means the intended role policy is not represented consistently in either client or server code.

### Impact

Any authenticated user can create, modify, deactivate, or bulk-update inventory data. Because inventory records influence quotations, project costing, and dashboard/business reporting, this can lead to:

- inventory tampering,
- price manipulation,
- inaccurate quote totals,
- stock quantity manipulation,
- and downstream financial/reporting integrity issues.

### Suggested Fix Plan

1. Define a single source of truth for permissions, e.g. `canManageInventory(auth.role)` in `src/lib/domain/policies.ts`.
2. Replace `requireAuth()` with a purpose-specific server guard such as `requireInventoryManager()` or `requireAdmin()` for inventory writes.
3. Keep read actions authenticated as needed, but enforce write authorization on the server even if the UI hides controls.
4. Pass a server-derived `canEdit` value into the inventory UI instead of hardcoding `true`.
5. Add tests proving non-admin users cannot create/update/delete/bulk-update inventory.

---

## Finding 3 — Sensitive workflow/server-maintenance actions use broad auth gates

**Severity:** Medium  
**Category:** auth bypass / role policy inconsistency  
**Affected files:**

- `src/actions/project-actions.ts`
- `src/actions/quotation-actions.ts`
- `src/actions/notification-actions.ts`
- `src/app/(dashboard)/projects/[id]/project-detail-shell.tsx`

### Evidence

Examples observed:

- `markProjectCompleted` uses only `requireAuth()`, while adjacent project status changes have explicit admin checks in `updateProject`.
- The project detail UI always renders the “Mark completed” button when status permits, while the “Advance status · admin only” select is admin-only.
- `expireOverdueQuotations` uses only `requireAuth()` even though comments describe it as a cron/scheduled invocation.
- `runScheduledNotificationChecks` uses only `requireAuth()` even though it inserts notifications across users and is named as a scheduled check.

### Root Cause

Workflow authority is split between UI affordances, comments, and partial server checks. Sensitive transitions and scheduled-maintenance actions are exported server actions, but their authorization does not consistently match the operation’s privilege level.

### Impact

A low-privileged authenticated user can invoke exported server actions directly to:

- complete projects and trigger completion side effects,
- expire quotations in bulk,
- run notification sweeps that create notifications for many users,
- and alter operational state outside intended admin/scheduler workflows.

### Suggested Fix Plan

1. Create explicit guards for sensitive operations:
   - `requireAdmin()` for admin-only workflow transitions,
   - `requireSchedulerSecret(request)` or a protected route handler for cron-only maintenance,
   - and role/policy helpers for operations team actions.
2. Remove cron-like jobs from generic exported server actions, or wrap them in route handlers protected by Vercel Cron headers / a signed secret.
3. Make UI authorization display match server authorization exactly; never rely on hidden buttons as security.
4. Add authorization regression tests for each server action with admin and non-admin sessions.

---

## Injection Review Notes

### SQL Injection

No direct raw SQL string concatenation was found in the scanned action paths. Observed `sql\`...\``fragments use Drizzle parameter interpolation for dynamic values such as`year`, search text, and dates. Continue to avoid `sql.raw()` and never build SQL fragments with user-controlled strings.

### XSS / HTML Injection

No `dangerouslySetInnerHTML`, `eval`, or `new Function` usage was found in the scanned source paths. The notification link issue above is still security-relevant because client-side navigation is performed with a stored, untrusted string.

---

## Requested UI / Correctness Bugs — Root Causes and Fix Suggestions

These were outside the strict injection/auth-bypass focus, so I did not patch them, but I documented likely root causes and fix plans.

### Numeric inputs render `01` when the user types `1`

**Affected file:** `src/components/inventory/inventory-dialog.tsx`

**Likely root cause:** numeric inputs are controlled with default numeric value `0`. For specification inputs, missing/invalid values are rendered as string `'0'`; `onChange` stores `Number(e.target.value)`. For form fields, `unitPrice` and `stockQty` start at `0` and convert text input to numbers on every keystroke. This prevents an empty editing state and leaves the literal `0` in the field, so typing appends to it.

**Suggested fix:** store numeric input drafts as strings while editing, use `placeholder="0"`, render `''` for unset/default draft values, and convert to numbers only during validation/submission. Avoid `Number('')` becoming `0` and avoid `parseInt('')` becoming `NaN` in controlled state.

### Inventory “Add New Item” modal cannot save

**Affected files:**

- `src/components/inventory/inventory-dialog.tsx`
- `src/lib/validators/inventory.ts`

**Likely root cause:** default specification objects contain required fields as empty strings or `0`, while the validator requires non-empty strings and positive numeric values for several categories. For the default `panel`, `brandModel`, `wattageW`, and `warranty` are invalid until populated. If the UI does not clearly surface nested specification errors, it feels like saving is completely broken.

**Suggested fix:** improve nested field error display, ensure each rendered required specification has clear labels and validation messages, use field-level schemas aligned with the active category, and consider allowing draft saves separately from active inventory records if incomplete data should be permitted.

### Need hover text on dashboard Orbit Style Card

**Affected files:**

- `src/app/(dashboard)/dashboard-page-client.tsx`
- `src/components/layout/nav-orbit.tsx`

**Current observation:** `NavOrbit` already uses tooltips for dock icons. Dashboard stat cards have visible title/hint text but no explicit hover tooltip/expanded hover text.

**Suggested fix:** add accessible tooltips or `aria-describedby` hover details to `StatCard`. Provide stable descriptions in `statMeta` and render via the existing tooltip components so mouse, keyboard, and screen-reader users all receive the same context.

### Font family not readable in dashboard decorations

**Affected files:**

- `src/app/layout.tsx`
- `src/app/globals.css`
- `src/app/(dashboard)/dashboard-page-client.tsx`

**Likely root cause:** the app uses local Inter for body and heading, but dashboard decorative labels use very small uppercase text, wide tracking, gradients, muted colors, and low-opacity decorative layers. The readability problem is likely typography treatment/contrast rather than a missing font family.

**Suggested fix:** use the body font for decorative labels, reduce excessive tracking on small text, increase contrast, avoid gradient text for important labels, and keep decorative text at least `12px` with adequate line height and WCAG contrast.

---

## Recommended Security Hardening Checklist

- Use server-side policy helpers for each privileged domain operation.
- Treat every exported server action as directly callable by authenticated clients.
- Validate all stored navigation targets as structured internal routes, not strings.
- Keep scheduled jobs behind route handlers protected by scheduler identity or signed secrets.
- Add authorization tests for non-admin, admin, and unauthenticated sessions.
- Continue using Drizzle parameter interpolation and avoid `sql.raw()` for user input.
