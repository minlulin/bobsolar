# Improvement Plan v2 — Daily-Life UX, UI & Business Logic

**Date:** 2026-09-05
**Sources:** Full-repo workflow dive (431 source files under `src/`), supersedes/complements `docs/improvement-plan.md` (2026-06-28, quotation→completion workflow) and `docs/CodeReviewReport.md`.
**Focus — three tracks, per request:**

- **Track A — Real-World Daily-Life UX:** what a partner/technician actually does between 07:00 and 18:00, and where the app fights them.
- **Track B — UI Improvements:** consistency, clarity, trust, and maintainability of the interface.
- **Track C — Business Logic Improvements:** correctness of workflow guards, financial metrics, and role policy.

---

## 0. Executive Summary

BOB Solar is a mature, security-conscious single-business solar ERP (Next.js 16 + Drizzle + Neon, double-entry ledger, strong Zod validation). The quotation→project→invoice→payment pipeline is complete and guarded. The biggest remaining gains are **not** new modules — they are:

1. **Close the daily-operations loops that are invisible today** — there is no invoices hub, warranty is missing from the primary nav, quotes never auto-expire (the cron doesn't exist), and the dashboard says "running optimistically" regardless of overdue items. (A-1, A-2, A-7, A-8)
2. **Fix four metric/policy defects** — cash transfers inflate dashboard cash-in/out; conversion rate counts open quotes as losses; a 1 MMK advance unlocks a project that requires a deposit; handover fields (which gate completion) are editable by any role. (C-1, C-2, C-3, C-5)
3. **Make the technician role real** — technicians can log in but can effectively only post remarks; every operational write requires owner/admin. (A-10, C-9)

**Seven quick wins from Phase 0 were already implemented in this session** (see §5) and verified with `pnpm typecheck && pnpm biome:check && pnpm test:code` (541 tests passing).

---

## 1. Workflow Analysis (Current State)

### 1.1 Pipeline map

```
Customer ──► Quotation (draft→sent→accepted/rejected/expired)
                │ convert (admin, unique per quote)
                ▼
            Project (planning→in_progress→installation_completed→completed)
                │ costs: materials (inventory consume) + labour/logistics (cash)
                │ change orders (draft→approved/rejected/cancelled)
                │ deposit gate (depositRequired/depositReceived) blocks start
                │ handover date + customer acknowledgment blocks completion
                ▼
            Invoice (draft→post→unpaid/partial/paid) ──► Payment (advance/final)
                │                                            │ ledger AR/deposits
                ▼                                            ▼
            Voucher (payment receipt PDF)              Double-entry ledger
                                                            → 13 finance reports
Warranty alerts (per project) ──► aftersales cadence (resolve/reopen, admin-only)
Purchases (PO draft→received, partial receipts) ──► supplier payments ──► stock
```

### 1.2 Daily-life journeys and where they snag

| Persona | Journey | Snags (finding refs) |
| --- | --- | --- |
| **Partner, 07:30** — scan the day | Open dashboard: revenue, pipeline, alerts, cash | Hero copy is static; no "what needs me today" digest; finance quick view double-counts internal transfers (A-7, C-1) |
| **Partner, 09:00** — chase money | Which invoices are overdue? Who hasn't paid? | No `/invoices` hub — must walk project-by-project or read the receivable-aging *report*; no overdue chips (A-1) |
| **Partner, 10:00** — quote follow-ups | Which sent quotes are stale? | Quotes never expire (no cron); conversion % deflated by open quotes in denominator (A-8, C-2) |
| **Partner, 11:00** — find "U Thura's project" | Search projects by customer | Projects list had no search box (server already supported it); quotation search was quote-number-only (A-3, A-5) ✅ fixed |
| **Technician, on site, 13:00** | Log installed materials, note issues | Can log remarks only — inventory consumption requires owner role; sees partner-grade nav incl. finance links that error at data level (A-10, C-9) |
| **Partner, 15:00** — warehouse check | Are we low on panels? | No reorder levels, no low-stock alerting anywhere (A-9) |
| **Partner, 17:00** — money moves | Move cashbox → bank, record daily spend | Internal transfer shows up as both "cash in" and "cash out" on the dashboard (C-1) ✅ fixed |
| **Aftersales, monthly** | Warranty cadence | Warranty page not in primary nav dock (A-2) ✅ fixed; resolve is admin-only even though owners run aftersales daily (C-9) |

### 1.3 Role model as implemented

- `admin` — everything (status changes, project metadata, user management, warranty resolve, quote expiry)
- `owner` — operational writes (payments, invoices, POs, costs) but **cannot** change project status/metadata; `requireOwner()` = admin∪owner (`src/lib/auth/validate.ts`)
- `technician` — view + project remarks only (`addProjectRemark` is the sole `requireAuth` write); separate name+PIN login

---

## 2. Track A — Real-World Daily-Life UX

### A-1 · No invoices hub (highest daily-life impact) ✅ **IMPLEMENTED (2026-09-06)**

**Evidence:** `src/app/(dashboard)/invoices/` contained only `new/`. Invoice visibility was per-project (`CompletedProjectVouchers`, project detail) or via `finance/reports/receivable-aging`.
**Impact:** "Who owes me money, which invoice, how late?" — the most frequent finance question — required project-hopping.

**Delivered:**

- ✅ **A1.1** `getInvoices(filters)` in `src/actions/invoice-actions.ts` — joins project + customer; tabs `open / overdue / draft / paid / all`; search by invoice № / project № / customer name; `page/limit`; global tab-count + outstanding-balance summary; overdue computed via `isInvoiceOverdue` domain helper (boundary = start of day; drafts/paid/voided never overdue).
- ✅ **A1.2** `src/app/(dashboard)/invoices/page.tsx` + `components/invoices-grid-client.tsx` (+ `layout/loading/error.tsx`): tab pills with live counts, debounced search, pagination, row cards (invoice №, status badge, OVERDUE chip, customer · project, invoiced/due dates with relative "N days overdue", total/paid/balance, open-project deep-link). Header shows outstanding total across open invoices.
- ✅ **A1.3** Paid/balance come from the transactionally maintained `paidAmount`/`balanceDue` columns (updated by payment allocations) — no client-side recomputation.
- ✅ **A1.4** "Invoices" added to Command Bar Navigation group (dock left untouched — 10 items already near mobile overflow; revisit with A-12/A-2.2 audit).
- ✅ **A1.5** Tests: `src/lib/domain/__tests__/invoice.test.ts` (overdue boundary semantics), `src/actions/invoice-actions.test.ts` (row mapping, overdue flags, summary, auth failure, invalid filters), `/invoices` added to `navigation-routes.test.ts`. Cache: new `CACHE_TAGS.INVOICES_LIST` invalidated by `createInvoice`, `postInvoice`, and `recordPayment` (allocations mutate balances).

### A-2 · Warranty invisible in primary navigation ✅ (implemented this session)

**Evidence:** `src/components/layout/nav-orbit.tsx` had 9 items, no `/warranty`; only the command bar listed it. **Fixed:** added a Warranty dock item. 
**Follow-ups:**

- [ ] **A2.1** Badge the dock icon with overdue-alert count (source: `getUpcomingAlerts`/warranty summary; cheap client refetch every 5 min).
- [ ] **A2.2** If the 10-item dock overflows on ≤360 px viewports, collapse Catalog+Purchases+Suppliers into a "Warehouse" sheet (see A-12 audit).

### A-3 · Projects list: no search, missing "Install done" pill, no pager

**Evidence:** `src/app/(dashboard)/projects/components/active-projects-client.tsx` had 4 pills only; `getProjects` already supports `search` (project № **and** customer name, `project-actions.ts:512-524`), `page/limit`, `year`, date ranges. **Fixed this session:** search box (debounced) + `installation_completed` pill.
**Follow-ups:**

- [ ] **A3.1** Add a pager (quotations grid pattern: `page` searchParam + prev/next).
- [ ] **A3.2** Surface `targetCompletion` overdue on cards ("Target was Aug 12") — data exists in `projects` table; drives the daily "what's late" scan.

### A-4 · Customers list: no debounce, no pagination ✅ (implemented this session)

**Evidence:** every keystroke fired `getCustomers` (`customers-page-client.tsx` passed `search` directly; quotations page already debounced 300 ms). Fixed limit 50, no pager (`total` was returned but unused).
**Fixed:** `useDebounce(300)` + prev/next pager + `page` searchParam, consistent with quotations.
**Follow-ups:**

- [ ] **A4.1** Add an "Archived" tab (server supports `isArchived` filter? if not, extend `customerFilterSchema`), and sort control (newest / name A-Z).

### A-5 · Quotation search was quote-number-only ✅ (implemented this session)

**Evidence:** `buildQuotationsWhere` matched only `quotations.quoteNumber` (`quotation-actions.ts` ~L91). Users search by customer name. **Fixed:** `or(...)` with an `exists` customer-name match (same pattern as `getProjects`), placeholder updated.
**Follow-ups:**

- [ ] **A5.1** Consider phone-number search on customer records (customers have `phone`); trgm indexes already exist (`0008_trgm-search-indexes.sql`) — verify the customer-name trgm index covers the quotation `exists` sub-plan acceptably in EXPLAIN.

### A-6 · Purchases list is unpaginated and heavy

**Evidence:** `getPurchaseOrders()` (`purchase-actions.ts:40-66`) loads up to 200 POs **with all items and payments eagerly**, no filter/search; `purchases/page.tsx` renders whatever returns.
**Fix:**

- [ ] **A6.1** Add `purchaseListFilterSchema` (status tabs: `draft / partially received / received / cancelled`, supplier filter, search by PO № / supplier, pagination).
- [ ] **A6.2** Slim the list query: aggregate `itemsCount`, `receivedCount`, `paidTotal` instead of `with: { items: true, payments: true }`; keep detail page heavy.
- [ ] **A6.3** Tests for the filters + a perf note in CODE_WIKI.

### A-7 · Dashboard has no "needs attention today" digest

**Evidence:** hero copy is static ("Your solar operations are running optimally…", `dashboard-page-client.tsx:75-77`) regardless of overdue warranty alerts, overdue invoices or stalled projects; the alerts card caps at 4 items.
**Fix:**

- [ ] **A7.1** Replace the static line with a computed status line: `N overdue warranty alerts · M overdue invoices (K MMK) · J quotes awaiting reply > 7 days`.
- [ ] **A7.2** Add a "Follow-ups today" bento card: overdue invoices, overdue/stale quotes (sent > 7 days), projects past `targetCompletion`, low-stock items (needs A-9) — each row deep-links to the filtered list.
- [ ] **A7.3** New action `getDailyDigest()` in `dashboard-actions.ts` (single `Promise.all`, `unstable_cache` 5 min, tagged for invalidation by payment/invoice/warranty writes).

### A-8 · Quotes never auto-expire (missing cron)

**Evidence:** `expireOverdueQuotations()` exists (`quotation-actions.ts:856`) but (a) is invoked **only by tests**, (b) `vercel.json` schedules only `/api/cron/backup`, and (c) the action calls `requireAdmin()` which a cron request can never satisfy. A comment (`quotation-actions.ts:180-182`) claims it "runs on a schedule" — it doesn't.
**Impact:** `sent` quotes stay "sent" forever → Sent tab noise, stale pipeline value, and conversion-rate denominator drift.
**Fix:**

- [ ] **A8.1** Extract expiry into a reusable internal function `expireOverdueSentQuotations()` (no auth) called by: (1) new `GET /api/cron/expire-quotes` guarded by `CRON_SECRET` (mirror `api/cron/backup/route.ts`), and (2) the existing admin action (keep for manual runs).
- [ ] **A8.2** Add cron entry `{"path": "/api/cron/expire-quotes", "schedule": "17 1 * * *"}` to `vercel.json`.
- [ ] **A8.3** Test: route 401s without secret; expiry only touches `sent` quotes with `validUntil < now`.

### A-9 · No reorder levels / low-stock alerting

**Evidence:** `inventoryItems` has `stockQty` (+ non-negative CHECK) but no `reorderLevel`; no low-stock notification types exist; dashboard never surfaces stock risk. For a warehouse-driven installer this is the classic "we forgot to order panels" failure.
**Fix:**

- [ ] **A9.1** Migration: `reorder_level integer default 0 not null` on `inventory_items`; schema + validator + inventory form field.
- [ ] **A9.2** Low-stock badge in catalog list (`stockQty <= reorderLevel` → amber/red chip) and a filter tab "Low stock".
- [ ] **A9.3** Include low-stock items in the A-7 digest; optional notification on receipt-consumption crossings (reuse `notifyAllUsers`).
- [ ] **A9.4** "Suggest PO" affordance: from a low-stock item, prefill `/purchases/new` with that item (see existing new-purchase client).

### A-10 · Technician experience is under-specified

**Evidence:** technicians authenticate via `/technician-login` (name + PIN) and land in the same dashboard; nearly every write is `requireOwner` (payments, invoices, costs, consumption). The only `requireAuth`-level writes are project remarks (`addProjectRemark`, `project-actions.ts:1479`). Nav shows Finance/Owner Portal links whose data actions will reject at runtime (`requireOwner` → redirect/error), producing dead-end UI.
**Fix:**

- [ ] **A10.1** Define a permission matrix in `src/lib/domain/user-roles.ts` (e.g., technician: view projects, add remarks, consume inventory against assigned project, resolve warranty alerts they performed; no finance).
- [ ] **A10.2** Role-adapt the nav (`navItems` filtered by role) and dashboard (technician sees "my projects", not revenue).
- [ ] **A10.3** Gate actions per matrix; add tests for each role×action pair (extend `project-actions.guard.test.ts` pattern).

### A-11 · Large-amount inputs are raw

**Evidence:** money fields are plain text (`costForm.amount` string; commas stripped at submit, `project-detail-shell.tsx:464+`). MMK amounts run to tens of millions — mis-typed zeros are easy and invisible.
**Fix:**

- [ ] **A11.1** Shared `<MoneyInput>` (numeric keyboard on mobile, live thousands-separated preview, MMK suffix, paste normalization).
- [ ] **A11.2** Adopt for project costs, payments, invoice lines, PO lines, quotation unit prices.

### A-12 · Mobile & offline audit (PWA in name, unverified in practice)

**Evidence:** Serwist SW exists (`public/sw.js`, `@serwist/next`), dock + bento grids are desktop-first; project detail is very dense (2,118-line shell); e2e specs don't cover mobile viewports.
**Fix:**

- [ ] **A12.1** Playwright mobile-viewport suite (375×812) across dashboard, project detail, quote editor, payment form.
- [ ] **A12.2** Verify offline fallback & revalidation UX (SW cache vs server data staleness — stale money figures on reconnect must be obvious).
- [ ] **A12.3** Dock overflow behavior with 10 items (see A-2.2).

---

## 3. Track B — UI Improvements

### B-1 · Status/label SSoT in the project header ✅ (partially, this session)

**Evidence:** badge showed raw `proj.status.replace("_", " ")` → "installation completed" (un-styled casing) vs the canonical `PROJECT_STATUS_LABELS` map (`src/lib/domain/project.ts`). **Fixed** for the header badge.
**Follow-ups:**

- [ ] **B1.1** Project tab strip renders raw keys (`item.replace("_"," ")` → "change orders"); use a `PROJECT_TAB_LABELS` map.
- [ ] **B1.2** Sweep for other `.replace("_", " ")` uses (e.g., status-change notification messages in `updateProject`) and route them through label maps.

### B-2 · `project-detail-shell.tsx` is a 2,118-line monolith

**Evidence:** all tabs (overview, costs, change orders, remarks, warranty), all forms, and all mutation handlers live in one client component; change orders are fetched via `useEffect` + local `any[]` state instead of TanStack Query hooks — inconsistent with the rest of the data layer (`use-projects.ts` etc.) and untyped.
**Fix:**

- [ ] **B2.1** Extract `ChangeOrdersTab` (typed rows via `getProjectChangeOrders` hook), `CostsTab`, `WarrantyTab`, `OverviewTab`; shell keeps layout + state rail.
- [ ] **B2.2** Replace `any[]` change-order state with a proper type + `useQuery` (cache key in `src/lib/query-keys.ts`).
- [ ] **B2.3** `next/dynamic` the non-default tabs to cut the client bundle.

### B-3 · Inconsistent list states (loading/error/empty)

**Evidence:** inventory has a polished empty state with "Clear all filters"; customers/projects/quota grids differ in copy and structure; purchases renders its error inline in the server page while other lists render error panels in the client grid.
**Fix:**

- [ ] **B3.1** Shared components: `<ListError onRetry>` and `<ListEmpty icon title body action>` in `src/components/shared/`; adopt across customers, quotations, projects, purchases, invoices (A-1), warranty.

### B-4 · Dashboard trust signals

**Evidence:** finance quick view is `unstable_cache(..., revalidate: 60)` but renders no "as of" hint; users can't distinguish fresh vs cached cash numbers after recording a payment.
**Fix:**

- [ ] **B4.1** Timestamp chip ("Updated 12:03") using the query's `dataUpdatedAt`.
- [ ] **B4.2** Make stat cards clickable deep-links (Revenue → P&L, Active projects → filtered list, Pending quotes → Sent tab).

### B-5 · Reversible actions have no undo

**Evidence:** quotation archive has `restoreQuotation` (`quotation-actions.ts:822`) yet archiving shows a plain toast; customer delete is optimistic with failure toast only.
**Fix:**

- [ ] **B5.1** Sonner `action: { label: "Undo", onClick: restore }` for archive (restore exists) and for reject→back-to-draft transitions.
- [ ] **B5.2** For destructive deletes keep confirm dialogs; consider soft-delete/archive-first policy where not already in place.

### B-6 · Number formatting consistency

**Evidence:** `formatMMK` is good and widely used; capacity renders raw `Number(proj.systemSizeKwp)` ("6" vs "6.00 kWp"); some tables lack tabular numerals.
**Fix:**

- [ ] **B6.1** `formatKwp()` helper (fixed 2 decimals + "kWp"); apply to project header, cards, quotation PDF cover.
- [ ] **B6.2** `font-variant-numeric: tabular-nums` on all money columns (global utility class `money`).

### B-7 · Accessibility & motion audit

**Evidence:** skip-link exists (good); dock icons rely on tooltips; heavy motion (dock magnification, route transitions) — `prefers-reduced-motion` coverage unverified (`src/lib/motion.ts`); filter pills are custom buttons (focus visibility varies).
**Fix:**

- [ ] **B7.1** axe-core (via Playwright `axe` plugin) run on the 8 core pages; fix criticals.
- [ ] **B7.2** Reduced-motion variants for dock + route transitions (Motion's `useReducedMotion`).
- [ ] **B7.3** Ensure ≥44 px touch targets on dock + tabs; visible `focus-visible` rings on pills.

### B-8 · Loading parity

**Evidence:** `loading.tsx` exists for most routes; new pages (invoices hub A-1) must follow the same `ListGridSkeleton` pattern — add to the cross-cutting checklist rather than a separate work item.

---

## 4. Track C — Business Logic Improvements

### C-1 · Internal cash transfers inflate dashboard cash-in/out ✅ (implemented this session)

**Evidence:** `createCashTransfer` debits one cash account and credits another (`cash-transfer-actions.ts:21-42`). `getFinanceQuickView` summed **all** debits on cash accounts as "today cash in / month income" and all credits as out — a cashbox→bank move of 5,000,000 MMK showed as 5M in **and** 5M out the same day. Net movement was coincidentally correct; the gross figures (shown on the dashboard) were wrong.
**Fixed:** excluded `source_type = 'cash_transfer'` from the aggregation.
**Follow-ups:**

- [ ] **C1.1** Audit `src/actions/cash-movement-actions.ts` (built from payment tables — transfers appear to be *absent* rather than double-counted; confirm intent + document in CODE_WIKI) and the cash-flow report's treatment of transfers.
- [ ] **C1.2** Add a regression test asserting the quick-view SQL excludes transfers (pattern: `src/actions/dashboard-actions.test.ts` mock rows + inspect `.where` args or use a real DB test in `src/__tests__/db-workflow-master.test.ts`).

### C-2 · Conversion rate counted open quotes as losses ✅ (implemented this session)

**Evidence:** `closedTotal = accepted + rejected + expired + sent` (`dashboard-actions.ts`) — `sent` quotes are still **open** (awaiting decision); dividing accepted by that denominator systematically understated the conversion rate, and worsened as the sent pipeline grew.
**Fixed:** denominator is now decided outcomes only (accepted + rejected + expired); regression test added (`quotationConversionRate === 75` for the 6/1/1 mock with 2 sent).

### C-3 · Any advance payment unlocks deposit-gated projects

**Evidence:** `recordPayment` sets `depositReceived = true` on **any** advance when `depositRequired` (`payment-actions.ts:117-122`), regardless of amount vs `depositAmount`. A 1,000 MMK advance on a 5,000,000 MMK deposit clears the gate; `updateProject` then allows `planning → in_progress`.
**Fix:**

- [ ] **C3.1** Track cumulative advances per project (sum existing advances in the same transaction) and set `depositReceived` only when `cumulative + amount ≥ depositAmount`.
- [ ] **C3.2** UI: show "Deposit 2.5M / 5M collected" progress instead of a boolean banner; keep an explicit admin override flag (`depositWaivedBy`) for business exceptions.
- [ ] **C3.3** Tests: partial advance does not unlock; reaching threshold unlocks; override path.

### C-4 · Expired-validity quotes can still be accepted

**Evidence:** `updateQuotationStatus` checks only the transition map; `sent → accepted` is allowed even when `validUntil < today` (in practice quotes rarely flip to `expired` because of A-8).
**Fix:**

- [ ] **C4.1** In `updateQuotationStatus`, reject `sent → accepted` when `validUntil` is past unless the caller passes an explicit override (admin-only) with reason.
- [ ] **C4.2** Depends on A-8 for timely expiry; ship together.

### C-5 · Role gating inconsistency in `updateProject` undermines the completion gate

**Evidence:** metadata + status changes are admin-only (`project-actions.ts:884-893`), but the no-status-change branch lets **any authenticated user** (incl. technicians) set `handoverDate` and `handoverPdfUrl` — and `markProjectCompleted` hard-requires exactly those fields. A technician could satisfy the completion preconditions the admin gate exists to control.
**Fix:**

- [ ] **C5.1** Require admin/owner for `handoverDate`/`handoverPdfUrl` writes (mirror the metadata check); keep `notes` open if desired.
- [ ] **C5.2** Write an `audit_logs` row for handover-field changes (table + helpers already exist, `src/lib/security/audit.ts`).
- [ ] **C5.3** Test: technician cannot set handover date; admin can.

### C-6 · Invoice numbers are random, not sequential

**Evidence:** `INV-${today}-${uuid.slice(0,8)}` (`invoice-actions.ts:29-31`) — unique but unordered and unauditable; quotes (`QT-2026-0001`) and projects (`PJ-2026-0001`) already use advisory-locked sequences (`quote-number.ts`, `project-number.ts`, `AdvisoryLock`).
**Fix:**

- [ ] **C6.1** `INV-YYYY-####` via the existing `AdvisoryLock` + number-util pattern; migration-time backfill keeps legacy numbers.
- [ ] **C6.2** Sort default lists by number/date consistently.

### C-7 · Payment guards: over-collection & duplicate key too narrow

**Evidence:** final payments are capped at open AR (good), but advances are uncapped — collecting beyond the quote total silently grows `customer_deposits` with no signal; duplicate detection keys on (project, method, date, reference), so same-day same-amount advances with distinct references pass freely (may be legitimate).
**Fix:**

- [ ] **C7.1** Soft warning (not a block) when cumulative advances exceed `quotedTotal` − final-paid; require an explicit "overpayment accepted" checkbox that lands in notes.
- [ ] **C7.2** Surface identical same-day advances to the operator in the confirm toast before insert (fetch-by-key preview) rather than after-the-fact error.

### C-8 · Activity feed misses the events that matter

**Evidence:** `getRecentActivity` lists creations only (`createdAt` of quotes/projects/customers/alerts) and even labels completed projects by creation date (`dashboard-actions.ts:243-248` — "marked as completed" uses `createdAt`). Payments, invoice postings, status changes never appear.
**Fix:**

- [ ] **C8.1** Add: payments (from `projectPayments`), posted invoices (`projectInvoices` + journal), project completions (`actualCompletion`), PO receipts.
- [ ] **C8.2** Prefer `audit_logs` as the event source going forward if the coverage is sufficient.

### C-9 · Technician role is effectively read-only (pairs with A-10)

**Evidence:** warranty resolve/reopen is `requireAdmin` (`warranty-actions.ts:116,154`) although owners run aftersales; inventory consumption, costs, PO receipts all `requireOwner`. The role matrix must be a deliberate decision, not an accident of which guard was imported.
**Fix:**

- [ ] **C9.1** Write the intended matrix into `AGENTS.md`/`CODE_WIKI.md` first (product decision), then align guards + tests (see A-10).

### C-10 · QA hygiene

- [x] **C10.1** ✅ **FIXED (2026-09-06):** `src/__tests__/auth-login-lockout.test.ts` was flaky on fast machines — the mocked upsert returned `lockedUntil: new Date()` captured *after* the action's `now`, so same-millisecond resolution made `lockedUntil > now` false and the assertion saw "Invalid credentials". Mock now returns a deterministically future `lockedUntil` (`+60s`); verified 8/8 consecutive green runs. This flake was also blocking `git push` via the lefthook `green:code` quality gate.
- [ ] **C10.2** `.env.example` mentions `pnpm v11+ / Node 20+` in README vs `engines: >=24 <26` — align docs (CI uses Node 24).

---

## 5. Phase 0 — Quick Wins Implemented in This Session ✅

All verified: `pnpm typecheck` ✅ · `pnpm biome:check` (461 files) ✅ · `pnpm test:code` 541 passed / 6 skipped ✅.

| # | Change | Files |
| --- | --- | --- |
| KW-1 (C-2) | Conversion-rate denominator excludes open `sent` quotes + regression test | `src/actions/dashboard-actions.ts`, `dashboard-actions.test.ts` |
| KW-2 (C-1) | Dashboard cash in/out excludes internal `cash_transfer` journal entries | `src/actions/dashboard-actions.ts` |
| KW-3 (A-4) | Customers search debounced (300 ms) + pagination controls | `src/app/(dashboard)/customers/components/customers-page-client.tsx` |
| KW-4 (A-5) | Quotation search matches customer name too; placeholder updated | `src/actions/quotation-actions.ts`, `quotations-grid-client.tsx` |
| KW-5 (A-2) | Warranty added to the NavOrbit dock | `src/components/layout/nav-orbit.tsx` |
| KW-6 (B-1) | Project header badge uses canonical `PROJECT_STATUS_LABELS` | `src/app/(dashboard)/projects/[id]/project-detail-shell.tsx` |
| KW-7 (A-3) | Projects list: search box (project № / customer) + "Install done" filter pill | `src/app/(dashboard)/projects/components/active-projects-client.tsx` |

---

## 6. Roadmap & Effort

| Phase | Items | Est. | Risk |
| --- | --- | --- | --- |
| **1 — Close the daily loops** (1–2 wks) | ~~A-1 invoices hub~~ ✅ done · A-8 expiry cron (+C-4) · C-3 deposit accumulation · A-7 digest v1 (overdue invoices/alerts/stale quotes) · B-5 undo for archive | 3–5 days remaining | Low–Medium (C-3 needs care) |
| **2 — Operations depth** (2–4 wks) | A-9 reorder levels (migration) · C-6 invoice numbering (migration/backfill) · A-6 purchases pagination · B-2 split project shell · C-5 role gates + audit · C-8 activity feed · A-11 MoneyInput | 7–10 days | Medium (schema changes, bundle refactor) |
| **3 — Roles & field readiness** (3–5 wks) | A-10/C-9 technician matrix + role-adapted nav/dashboard · A-12 mobile/offline audit + fixes · B-7 a11y audit · B-4 dashboard deep-links | 8–12 days | Medium (product decisions, cross-cutting) |

**Suggested order rationale:** Phase 1 items are all "invisible today, needed daily" loops with no schema changes (except none) and immediately reduce partner busywork. Phase 2 adds structural integrity items that need migrations and refactors. Phase 3 requires product decisions (permission matrix) best made with the team.

---

## 7. Verification Gates (every phase)

- `pnpm green:code` (typecheck + biome + unit tests) — mandatory per commit
- `pnpm test:db` on the disposable Neon branch for anything touching actions/ledger (esp. C-1, C-3, C-6, C-7)
- `pnpm e2e` for new routes (A-1) and mobile viewports (A-12)
- New cache keys/tags registered in `src/lib/cache-tags.ts` / `src/lib/query-keys.ts`; every write path invalidates them (existing house rule — keep honoring it)

## 8. Success Metrics (what "better" means)

- Time-to-answer for the 4 daily questions: "who owes me?" (A-1), "what's late?" (A-7), "who do I chase?" (A-8/A-7), "are we stocked?" (A-9) — target: ≤ 2 clicks from dashboard.
- Dashboard cash-in/out matches bank/cashbox statement deltas for a week including ≥ 3 internal transfers (C-1).
- Zero projects started with deposit < agreed amount (C-3); zero completions with unacknowledged handover set by non-admin (C-5).
- Technicians log ≥ 1 field action/day without partner intervention (A-10).
