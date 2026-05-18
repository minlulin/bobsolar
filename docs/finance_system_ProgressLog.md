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

## Phase 1: Ledger Integrity Hardening
- [ ] Enforce journal immutability policy (no update/delete for posted journal entries; reversal only).
- [ ] Add explicit reversal transaction flow (`manual_adjustment` with reference to original entry).
- [ ] Add DB constraints/index checks for high-volume query paths (entry date, source pair, project/account filters).
- [ ] Add ledger audit metadata policy (`createdBy`, source type/id, memo standards).
- [ ] Add tests for invariants:
  - [ ] debit = credit
  - [ ] one-sided journal lines only
  - [ ] invalid account mapping blocked
  - [ ] reversal keeps net effect correct

## Phase 2: Master Ledger Page
- [ ] Create `/finance/ledger` page with filters:
  - [ ] date range
  - [ ] account code
  - [ ] project
  - [ ] source type (`project_payment`, `project_expense`, `manual_adjustment`, etc.)
- [ ] Add ledger table view:
  - [ ] journal entry header (date, source, memo, createdBy)
  - [ ] expandable debit/credit lines
  - [ ] per-entry balance indicator
- [ ] Add running-balance view by account (optional toggle).
- [ ] Add export option (CSV) for accountant workflow.

## Phase 3: Finance Dashboard (Dedicated Page)
- [ ] Create `/finance` dashboard summary cards:
  - [ ] Total Income (period)
  - [ ] Total Expense (period)
  - [ ] Net Profit/Loss (period)
  - [ ] Accounts Receivable outstanding
  - [ ] Cash + Wallet + Bank balances
- [ ] Add trend charts:
  - [ ] income vs expense by month
  - [ ] expense breakdown by type (`material`, `labor`, `transport`, `misc`)
- [ ] Add receivable risk widgets:
  - [ ] overdue/unpaid completed projects
  - [ ] top outstanding customers/projects
- [ ] Add "data consistency" card (journal-backed totals vs operational totals check).

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
