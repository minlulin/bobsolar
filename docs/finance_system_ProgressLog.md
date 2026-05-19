# Finance System Progress Log

Date: 2026-05-18
Repo: `C:\bobsolar`
Goal: Build a business-grade finance system with strict double-entry accounting, master ledger, finance dashboard, and dashboard quick view.

## Current Baseline (Already Done)
- [x] Finance SSoT domains and enums are defined.
- [x] Core ledger schema exists (`ledger_accounts`, `journal_entries`, `journal_lines`).
- [x] Double-entry engine and balancing assertions are implemented.
- [x] Income posting is wired with payment-method based asset mapping.
- [x] Expense posting now supports payment-method based credit mapping.
- [x] Core tests and gates (`typecheck`, `lint`, `build`, targeted tests) pass.
- [x] Phase 1: Ledger Integrity Hardening complete (2026-05-19).
  - Journal immutability enforced, reversal flow implemented.
  - `deleteProjectCost()` now reverses journal entries (critical bug fixed).
  - `getFinanceSummary()` is now journal-backed (was reading operational tables).
  - `isReversed` / `reversedBy` columns added to `journal_entries`.
  - 15 new invariant tests added.
- [x] Phase 2: Master Ledger Page complete (2026-05-19).
  - `/finance/ledger` page with filters (date range, account, project, source type).
  - Expandable journal entry rows with debit/credit line details.
  - Account balances panel with toggle view.
  - CSV export for accountant workflow.
  - Added to navigation dock with BookOpen icon.
- [x] Phase 3: Finance Dashboard complete (2026-05-19).
  - `/finance` dashboard with bento-grid layout for professional, breathable design.
  - Summary cards: Total Income, Total Expense, Net Profit/Loss, Accounts Receivable.
  - Asset cards: Cash on Hand, Digital Wallets, Bank Accounts.
  - Period selector dropdown (30d, 90d, 1y, all time).
  - Income vs Expense trend chart (minimal SVG line chart).
  - Expense breakdown by type with progress bars.
  - Receivable risk widget showing overdue/unpaid projects.
  - Data consistency card comparing journal vs operational totals.

## Phase 1: Ledger Integrity Hardening
- [x] Enforce journal immutability policy (no update/delete for posted entries; reversal only).
  - Added `assertJournalImmutability()` function that throws on any update/delete attempt.
  - Documented reversal-only policy in code comments.
- [x] Add explicit reversal transaction flow (`manual_adjustment` with reference to original entry).
  - Added `reverseJournalEntry()` that creates a balancing reversal entry.
  - Added `assertJournalEntryNotReversed()` to prevent double-reversal.
  - Added `getJournalEntryWithLines()` helper for entry retrieval.
  - Added `isReversed` and `reversedBy` columns to `journal_entries` table (migration 0014).
- [x] Fix critical bug: `deleteProjectCost()` now reverses the linked journal entry before deleting the cost record.
- [x] Add DB constraints/index checks for high-volume query paths (entry date, source pair, project/account filters).
  - Added `journal_entries_is_reversed_idx` index for reversal filtering.
  - Existing indexes: `journal_entries_entry_date_idx`, `journal_entries_source_idx`, `journal_entries_created_by_idx`.
- [x] Add ledger audit metadata policy (`createdBy`, source type/id, memo standards).
  - All journal entries require `createdBy`, `sourceType`, `sourceId`, and optional `memo`.
  - Reversal entries auto-generate descriptive memos referencing original entry.
- [x] Fix `getFinanceSummary()` to be journal-backed (was reading from operational tables).
  - Now queries `journal_entries` + `journal_lines` instead of `projectPayments` + `projectCosts`.
  - Excludes reversed entries from all totals.
- [x] Add tests for invariants:
  - [x] debit = credit (unbalanced entry rejected)
  - [x] one-sided journal lines only (both debit+credit or neither rejected)
  - [x] invalid account mapping blocked (inactive/missing accounts rejected)
  - [x] reversal keeps net effect correct (original + reversal = 0)
  - [x] journal immutability enforced (update/delete throws)
  - [x] payment method mapping variants handled
  - [x] cost type fallback to misc_expense

## Phase 2: Master Ledger Page
- [x] Create `/finance/ledger` page with filters:
  - [x] date range (dateFrom, dateTo inputs)
  - [x] account code (dropdown with all 15 ledger accounts)
  - [x] project (dropdown populated from DB)
  - [x] source type (`project_payment`, `project_expense`, `manual_adjustment`, etc.)
- [x] Add ledger table view:
  - [x] journal entry header (date, source badge, memo, createdBy)
  - [x] expandable debit/credit lines (click to expand/collapse)
  - [x] per-entry balance indicator (total debit/credit shown in header)
  - [x] reversed entries visually marked with muted background and "Reversed" badge
- [x] Add running-balance view by account (optional toggle).
  - Account Balances panel shows total debit, credit, and net balance per account
  - Toggle button to show/hide the panel
  - Balances filtered by selected date range
- [x] Add export option (CSV) for accountant workflow.
  - Exports all visible entries with line details
  - Filename includes current date: `ledger-YYYY-MM-DD.csv`
- [x] Pagination support (50 entries per page, Previous/Next buttons)
- [x] Added to navigation dock (BookOpen icon, active state for /finance/* routes)
- [x] Design follows BOB Solar Design System:
  - Clean, professional layout with Deep Navy headings
  - Solar Gold accent for active navigation
  - Subtle borders, 12px radius, generous whitespace
  - Color-coded source type badges (green=payment, red=expense, amber=adjustment)

## Phase 3: Finance Dashboard (Dedicated Page)
- [x] Create `/finance` dashboard summary cards:
  - [x] Total Income (period) - journal-backed from solar_installation_revenue
  - [x] Total Expense (period) - journal-backed from expense accounts
  - [x] Net Profit/Loss (period) - calculated from income - expense
  - [x] Accounts Receivable outstanding - from accounts_receivable ledger balance
  - [x] Cash + Wallet + Bank balances - from asset account balances
- [x] Add trend charts:
  - [x] income vs expense by month - minimal SVG line chart with data points
  - [x] expense breakdown by type (`material`, `labor`, `transport`, `misc`) - progress bar chart
- [x] Add receivable risk widgets:
  - [x] overdue/unpaid completed projects - shows outstanding amount and days overdue
  - [x] top outstanding customers/projects - sorted by outstanding amount
- [x] Add "data consistency" card (journal-backed totals vs operational totals check).
  - Compares journal income vs operational payments
  - Compares journal expenses vs operational costs
  - Shows discrepancies if any mismatch detected
- [x] Design follows BOB Solar Design System:
  - Bento-grid layout with varying card sizes
  - Deep Navy headings, Solar Gold accents
  - Generous whitespace, 12px radius, subtle borders
  - Color-coded metrics (emerald=income, rose=expense, amber=AR)
  - Minimal SVG charts with clean grid lines
  - Period selector for flexible time range analysis

## Phase 4: Main Dashboard Quick View
- [ ] Add compact finance widgets on main dashboard:
  - [ ] Today cash-in / cash-out
  - [ ] Month net movement
  - [ ] Outstanding receivable count + amount
- [ ] Add quick links:
  - [ ] "View Master Ledger"
  - [ ] "Open Finance Dashboard"
  - [ ] "Post Manual Adjustment" (permission-gated)
- [ ] Ensure widgets are journal-backed (no duplicated logic).

## Phase 5: Manual Accounting Operations
- [ ] Add secure manual journal entry form (admin/peer policy aligned with current app rules).
- [ ] Add opening balance posting flow for first-time finance initialization.
- [ ] Add backfill flow for historical migration entries.
- [ ] Add validation UX:
  - [ ] show debit/credit totals live
  - [ ] block submit unless balanced
  - [ ] require memo + source context

## Phase 6: Reporting and Period Close
- [ ] Profit & Loss report (period-based, journal-backed).
- [ ] Cash movement report by account and method.
- [ ] Receivable aging report buckets.
- [ ] Month-end close checklist:
  - [ ] all project payments posted
  - [ ] all project costs posted
  - [ ] unresolved mismatches reviewed
  - [ ] close snapshot generated

## Phase 7: Performance, Security, and Reliability
- [ ] Add pagination and server-side filtering for large ledgers.
- [ ] Add query optimization for finance endpoints (indexes + select shape review).
- [ ] Add role/permission checks for sensitive finance actions.
- [ ] Add monitoring metrics:
  - [ ] journal post failures
  - [ ] imbalance rejection count
  - [ ] finance page latency
- [ ] Add recovery playbook for failed posting transactions.

## Definition of Done (Finance System)
- [ ] Every finance KPI and report is journal-backed (single source of truth).
- [ ] Double-entry invariants are enforced in app logic + tests.
- [ ] Master Ledger page is usable by business operations.
- [ ] Finance dashboard provides daily and monthly decision visibility.
- [ ] Main dashboard quick view provides at-a-glance finance status.
- [ ] Full quality gates pass: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

## Execution Order Recommendation
1. Phase 1 (integrity hardening)
2. Phase 2 (master ledger)
3. Phase 3 (finance dashboard)
4. Phase 4 (main dashboard quick view)
5. Phase 5 (manual ops)
6. Phase 6 (reports + close)
7. Phase 7 (perf/security hardening)
