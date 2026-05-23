Pre-Production Audit Report — BOB Solar
Audit Date: 2026-05-23 Scope: Full codebase audit (src/), 43 files reviewed, 4 parallel deep-dives Severity Scale: 🔴 Critical | 🟠 High | 🟡 Medium | 🔵 Low

SPECIAL REQUEST: Database Migration Mismatch — Inventory Section
SSoT Comparison Result: ✅ Schema ↔ Migrations are in sync
All 11 columns (id, name, category, unit, cost_price, unit_price, stock_qty, brand, model_number, specifications, is_active, updated_at) match perfectly between schema.ts:139-152 and the migration chain (0000 → 0006 → 0017 → 0018). The cost_price was retroactively added in migration 0018 to match schema, and unit_price precision was upgraded from numeric(15,0) to numeric(15,2) in migration 0017.

Design note: inventory_items has no created_at column, unlike other entities. Intentional but inconsistent.

However, 2 critical mismatches exist BETWEEN schema/validators and runtime code:
#	File	Lines	Issue
🔴 B1	src/actions/inventory-actions.ts	140-142	Zero prices silently skipped (costPrice: val ? val.toString() : undefined → 0 is falsy)
🔴 B2	src/lib/validators/inventory.ts + src/components/inventory/inventory-dialog.tsx	validator:8,28-29,51 + dialog:53-73	Default specs (wattageW:0, voltageV:0) fail .positive() validation
Recommended fix plan:

inventory-actions.ts:140-142 — change to costPrice: updateData.costPrice !== undefined ? updateData.costPrice.toString() : undefined
inventory-dialog.tsx:53-73 — change defaults to 1 or change validators to .nonnegative()
inventory-actions.ts:102-103,140-142,198-200 — use .toFixed(2) instead of .toString() for decimal prices
1. 🔴 LOGIC FAILURES (9 issues)
L1 — 🔴 Redirect swallowed by try-catch in ALL server actions
Files: inventory-actions.ts:60/75/94/125/162/189/234, project-actions.ts:341/458/..., payment-actions.ts:29/107/..., quotation-actions.ts:135/168/..., customer-actions.ts:36/71/... Issue: requireAuth() calls redirect("/login") which throws NEXT_REDIRECT. All server actions wrap calls in try { requireAuth(); ... } catch { return handleActionError(...) }, and handleActionError does not rethrow NEXT_REDIRECT. The redirect is silently downgraded to an error response. Note: settings-actions.ts:57-61 has a comment acknowledging this and correctly moves requireAuth() outside try-catch. Fix: Move requireAuth() / requireAdmin() before the try-catch block in every server action.

L2 — 🟠 getProjects does not use a tiebreaker column in ORDER BY
File: project-actions.ts:405 Issue: .orderBy(desc(projects.createdAt)) — with LIMIT/OFFSET pagination, same-timestamp records can appear on multiple pages or be skipped. Fix: Add .thenBy(projects.id) as secondary sort.

L3 — 🟠 nextProjectSequence race condition (TOCTOU)
File: project-actions.ts:102-112 Issue: Reads max project number, increments in JS, then inserts. Relies on unique constraint + retry. Under concurrency, retries may cause deadlocks. Fix: Use PostgreSQL SEQUENCE or advisory lock (as done in quotation creation).

L4 — 🟠 updateQuotation deletes ALL items then re-inserts
File: quotation-actions.ts:463-502 Issue: Even if one item changes, all items are deleted and re-inserted. Destroys DB-generated IDs, increases write volume, risk of concurrent loss. Fix: Implement differential update (update/insert/delete changed items only).

L5 — 🟠 getMonthlyTrend uses locale-dependent to_char
File: finance-dashboard-actions.ts:202,217 Issue: to_char(entryDate, 'YYYY-MM') output depends on DB locale setting. Fix: Use to_char(entry_date, 'YYYY-MM') or ISO format string.

L6 — 🟡 getReceivableAgingReport bucket labels are off by one range
File: receivable-aging-actions.ts:96-112 Issue: Variable days30 holds 31–60 day range, days60 holds 61–90, etc. Misleading reporting labels. Fix: Rename to days31to60, days61to90, days91to120, days121plus.

L7 — 🟡 accepted quotation status allows rollback to draft
File: quotation.ts:26 Issue: Business logic allows accepted → draft. If a project exists from the accepted quote, rolling back creates orphaned financial basis. Fix: Block accepted → draft if a project references the quotation.

L8 — 🟡 Dashboard turnover rate denominator includes pending quotes
File: dashboard-actions.ts:140 Issue: closedTotal = accepted + rejected + expired + sent. Including sent (pending) artificially lowers conversion rate. Fix: Use accept / (accept + reject + expire) — only decided quotes.

L9 — 🔵 Duplicate error chain formatting may produce long messages
File: error.ts:36-57 Issue: formatErrorChain traverses Error.cause (depth 6). With cyclic cause chains, output can be very long despite depth limit. Fix: Add a max-length cap on total output string.

2. 🔴 BUGS (8 issues)
B1 — 🔴 Zero-price silently skipped in updateInventoryItem
File: inventory-actions.ts:140-142 Issue: costPrice: updateData.costPrice ? updateData.costPrice.toString() : undefined — 0 is falsy, so setting price to 0 silently fails. DB retains old value. Fix: Use !== undefined instead of truthy check.

B2 — 🔴 Default spec values (0) fail Zod .positive() validation
File: inventory-dialog.tsx:53-73, validators/inventory.ts:8,28-29,51 Issue: Defaults: wattageW:0, voltageV:0, capacityAh:0, ratingAmpere:0. Zod schema uses .positive() which rejects 0. Form submission fails silently on untouched spec fields. Fix: Change defaults to 1 or change validators to .nonnegative() if 0 is valid.

B3 — 🔴 Cash outflow reported using wrong debit side
Files: dashboard-actions.ts:363-375, payment-actions.ts:189-192 Issue: todayCashOut queries debit where sourceType = "project_expense". Expense entries are Dr Expense, Cr Cash — the cash outflow is on the credit side. Debiting expense accounts gives expense amounts, not actual cash outflows. Fix: Query the credit side of cash/asset accounts instead.

B4 — 🟠 Number.parseInt truncates decimal unit prices
File: quote-items.tsx:136 Issue: Number.parseInt(unitPriceInput, 10) discards decimal places (e.g., 1250.50 → 1250). Fix: Use Number.parseFloat or Number().

B5 — 🟠 revalidateTag("tag", "default") has invalid second argument
Files: inventory-actions.ts:112,152,171,207, quotation-actions.ts:305,382,506,602,658,687,711,737 Issue: revalidateTag accepts only a single string param. "default" is silently ignored or will throw if Next.js validates argument count. Fix: Remove "default" second argument.

B6 — 🟡 Month-end close report paymentCount/costCount always returns 1 or 0
File: month-end-close-actions.ts:178-179 Issue: paymentCount: operationalPaymentsRow ? 1 : 0 — aggregation query always returns a row (coalesce ensures this), so count is always 1. Fix: Use COUNT(*) subqueries.

B7 — 🟡 repairOrphanCost always credits raw_materials for material costs, ignoring payment method
File: recovery-actions.ts:225-238 Issue: If a material cost has paymentMethodId (direct purchase), it should credit cash/bank, not raw_materials. Fix: Check paymentMethodId first — if present, credit the payment method's asset account.

B8 — 🔵 reverseJournalEntry allows double reversals
File: ledger.ts:236-276 Issue: No call to assertJournalEntryNotReversed. Multiple reversals of the same entry net to zero but allow manipulation. Fix: Add assertJournalEntryNotReversed at the top of reverseJournalEntry.

3. 🔴 BUSINESS LOGIC VULNERABILITIES (8 issues)
V1 — 🔴 Month-end close does not actually close anything
File: month-end-close-actions.ts:46-188 Issue: getMonthEndCloseReport is read-only. No period lock flag is set. No data snapshot is taken. No protection against back-dated entries into "closed" periods. The entire close workflow is a facade. Fix: Implement: (a) period lock flag in DB, (b) P&L snapshot generation, (c) validation preventing entries to locked periods.

V2 — 🟠 Voucher amounts provided by client, never validated against project
File: voucher-actions.ts:34-36, voucher.ts:7-8 Issue: totalAmount and paidAmount come from client with no server-side cross-check against project.quotedTotal or actual payment totals. A malicious/buggy client can create inflated vouchers. Fix: Server should derive totalAmount from project.actualTotal ?? project.quotedTotal and paidAmount from actual project payments.

V3 — 🟠 Revenue recognition is cash-basis only, never accrual
Files: recovery-actions.ts:177-183, payment-actions.ts:77-88 Issue: Completed projects with no payments show zero revenue on financial reports. No accrual entry (Dr AR, Cr Revenue) is created at project completion. The solar_installation_revenue account is defined but never auto-populated. Fix: Add revenue recognition entry at project completion milestone.

V4 — 🟠 Consistency check ignores reversed payments, reports false discrepancies
File: finance-dashboard-actions.ts:450-483 Issue: journalIncome filters isReversed = false. operationalPayments does NOT filter reversed payments. A reversed payment shows a false mismatch. Fix: Add isReversed flag to projectPayments table and filter reversed payments in consistency check.

V5 — 🟠 updateQuotationStatus lacks role check
File: quotation-actions.ts:343 Issue: Only requireAuth() is called. Any authenticated user (including "staff") can change quotation status to "accepted"/"rejected". Fix: Add requireAdmin() or role-based check if business rules require it.

V6 — 🟡 Manual journal entry does not validate account direction
File: manual-journal-actions.ts:40-44 Issue: No rules prevent Dr Revenue, Cr Cash (inverting revenue). Revenue account should always be credited; expense accounts should always be debited. Fix: Add validation: revenue accounts must be credited, expense accounts must be debited, asset accounts must not be mixed arbitrarily.

V7 — 🟡 sourceId in journal entries has no foreign key constraint
File: schema.ts:440 Issue: sourceId: uuid("source_id") — no FK reference to projectPayments.id or projectCosts.id. Deletion of source records orphans journal entries. Fix: Add nullable FK constraints to payment/cost tables.

V8 — 🔵 Session-stored role is dead data
File: auth-actions.ts:90, validate.ts:28 Issue: createSession() persists role into the sessions table, but resolveCurrentAuth() reads role from the users table. The stored role is never read. Fix: Remove role from createSession() or add a comment explaining its audit purpose.

4. 🔴 PERFORMANCE BOTTLENECKS (6 issues)
P1 — 🟠 N+1 / massive LEFT JOIN in getProjects
File: project-actions.ts:389-414 Issue: LEFT JOIN on projectCosts inflates intermediate rows by number of costs per project (50x for projects with 50 costs). GROUP BY collapses it, but the planner must sort all inflated rows. Fix: Use correlated subquery or separate aggregation query for costTotal.

P2 — 🟠 getCustomer loads ALL related quotations and projects without pagination
File: customer-actions.ts:74-97 Issue: Fetching a customer with 200+ quotations and 100+ projects loads everything into memory in a single query. Fix: Lazy-load relations or add pagination.

P3 — 🟡 Full store subscription causes entire QuoteEditor to re-render on any change
File: quote-editor.tsx:60-61 Issue: Destructures all store fields (selectedCustomerId, items, discountPercent, taxPercent, notes, validUntil). Any field change (even typing a note) re-renders the entire editor tree including InventorySearch, QuoteItems, QuoteSummary, QuotePreview. Fix: Use individual store selectors or split into smaller components with narrower subscriptions.

P4 — 🟡 getFinanceSummary runs 3 sequential queries when 1 would suffice
File: payment-actions.ts:163-228 Issue: Two independent aggregate queries (in/out) followed by a grouped query. Could be combined with date_trunc + conditional aggregation. Fix: Use single query with FILTER (WHERE ...) clauses.

P5 — 🟡 setSpecValue callback recreated on every render
File: inventory-dialog.tsx:626-630 Issue: Inline function definition inside FormField.render prevents memoization of all child spec components. Fix: Memoize with useCallback or extract to a stable ref.

P6 — 🟡 getCachedFinanceQuickView double-query pattern in dashboard
File: dashboard-actions.ts:352-401 Issue: Two parallel queries for cash in/out that share the same date range and base table. SQL-level conditional aggregation would halve the query count.

5. 🔴 UI CRASH / UX BUGS (10 issues)
U1 — 🔴 Unhandled promise rejections in startTransition
File: quote-editor.tsx:83-125, 130-143 Issue: Async IIFE inside startTransition has no .catch() and no try-catch. If server action throws, it becomes an unhandled promise rejection that can crash React's commit phase in concurrent mode. Fix: Wrap in try-catch with toast.error() or chain .catch().

U2 — 🔴 No Error Boundary at app root
File: providers.tsx:100-128 Issue: Entire app tree wrapped in QueryClientProvider > ThemeProvider > LazyMotion — no <ErrorBoundary>. Any render crash unmounts the entire React tree with no fallback UI. Fix: Add <ErrorBoundary> with fallback UI at the Providers level.

U3 — 🔴 Spread of potentially null items crashes store
File: quote-builder-store.ts:178 Issue: items: [...quotation.items] — if quotation.items is null/undefined (malformed API data), spread throws TypeError. Fix: Add null guard: items: [...(quotation.items ?? [])].

U4 — 🔴 Crash on invalid Date in .toISOString()
Files: quote-summary.tsx:59, quote-preview.tsx:97 Issue: validUntil.toISOString().split("T")[0] and format(validUntil, "MMM dd, yyyy") — if validUntil is an invalid Date (e.g., from malformed store data), .toISOString() throws RangeError. Fix: Validate date before formatting, or use date-fns's isValid() guard.

U5 — 🟠 Unsafe type assertion on API response
File: page-client.tsx:34-40, 107 (inventory) Issue: const response = rawResponse as PaginatedItems — doesn't validate shape. If server returns unexpected data, accessing response.items throws TypeError. Fix: Add runtime shape validation (Zod parse) or at minimum a guard check.

U6 — 🟠 Auto-name derivation overwrites manual edits
File: inventory-dialog.tsx:508-517 Issue: useEffect fires on every spec change, calling form.setValue("name", derivedName), overwriting any manually typed custom name with no undo. Fix: Only auto-derive on first spec set. Add a "lock name" toggle or don't auto-overwrite once user has edited.

U7 — 🟠 Category change discards all specification input
File: inventory-dialog.tsx:567-574 Issue: Switching category immediately replaces all spec fields with defaults. Partially filled values lost without warning. Fix: Add confirmation dialog or preserve previous specs until form save.

U8 — 🟠 loadFromQuotation effect re-runs on every reference change
Files: quote-detail-view.tsx:91-93, quote-editor-wrapper.tsx:16-18 Issue: useEffect(() => { loadFromQuotation(quotation) }, [quotation, ...]) — if parent passes new object reference (from React Query refetch), the store resets, losing all unsaved edits. Fix: Use deep comparison or a version/key field.

U9 — 🟠 Customer selector shows empty on popover open
File: customer-selector.tsx:39-43 Issue: Query function returns [] when !debouncedSearch && !selectedCustomerId. User must type at least 1 character before any customers appear. Fix: Fetch initial customer list (paginated) when popover opens with empty search.

U10 — 🟡 Stale local state after store reset
File: quote-summary.tsx:23-24 Issue: const [discountInput, setDiscountInput] = useState(String(discountPercent)) — initializer runs once. If store values change externally, the input remains stale until user focuses it. Fix: Sync useEffect or compute derived state from store directly.

Summary Table
Severity	Logic	Bugs	Business Logic	Performance	UI/UX	Total
🔴 Critical	1	4	1	0	4	10
🟠 High	3	2	4	2	5	16
🟡 Medium	4	2	2	3	1	12
🔵 Low	1	0	1	1	0	3
Total	9	8	8	6	10	41


Priority Action Items (Top 5)
B1 — Fix zero-price skip in inventory-actions.ts:140-142 (active data corruption)
L1 — Move requireAuth() outside try-catch in all server actions (auth broken when redirect needed)
B3 — Fix cash outflow calculation in dashboard-actions.ts:363-375 (wrong financial reporting)
U1/U2 — Add Error Boundary + .catch() to startTransition (app crash surface)
V2 — Validate voucher amounts server-side against project data (financial integrity)