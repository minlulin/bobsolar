# Finance Audit And Company Expense Plan

Audit date: 2026-06-06

Affected skills consulted:
- `typescript-modern-skill`: strict TypeScript, SSoT, no unsafe widening, no `any`.
- `neon-postgres`: Postgres/Drizzle persistence and migration awareness.
- `code-pattern-guidance`: scoped audit and staged implementation planning.

## Scope

This review deep-dived the finance section, especially the double-entry ledger engine, project cost/payment flows, general/company expense code, finance dashboard reports, period controls, and navigation workflow.

The goal for Task 1 is correctness, not new feature expansion. Task 2 is a plan to support company expenses such as daily expenses, salary, electricity bills, rent, software, office supplies, and other overhead without requiring an active project.

## Current Finance Model

The codebase uses a double-entry model centered on:

- `ledger_accounts`: chart of accounts. SSoT account codes live in `src/lib/domain/finance.ts`.
- `journal_entries`: immutable headers with `sourceType`, `sourceId`, `entryDate`, and reversal flags.
- `journal_lines`: debit/credit lines. DB checks enforce non-negative amounts and single-sided lines.
- `createBalancedJournalEntry`: server-side ledger posting helper. It requires at least two lines, checks debit equals credit, checks accounting-period locks, seeds missing SSoT accounts, rejects inactive accounts, then inserts the journal entry and lines.

Project finance currently posts:

- Project invoice: debit `accounts_receivable`, credit `solar_installation_revenue`.
- Project payment:
  - Advance: debit mapped cash/bank/wallet asset, credit `customer_deposits`.
  - Final: debit mapped cash/bank/wallet asset, credit `accounts_receivable`.
- Project expense: debit a mapped operating expense account, credit a mapped cash/bank/wallet asset.
- Inventory consumption: debit `cost_of_goods_sold`, credit `raw_materials`.

Company/general expense support already exists in code:

- Schema: `general_expenses` table exists with `payee_name`, `amount`, `expense_date`, `account_id`, `payment_method_id`, `reference`, `notes`, `is_paid`, and `created_by`.
- Ledger helper: `recordGeneralExpense` posts paid expenses as debit operating expense, credit cash/bank/wallet asset. It posts unpaid/accrued expenses as debit operating expense, credit `accounts_payable_general`.
- Route: `/finance/expenses` exists and has a form/list client.

## Findings

### F-01: General expense submission can show success even when the server action fails

Severity: High

Evidence:

- `ActionResponse` represents failures as `{ success: false, error }`, not as thrown client errors: `src/lib/utils/action-response.ts:1`.
- `submitGeneralExpense` catches errors and returns `handleActionError(...)`: `src/app/(dashboard)/finance/expenses/actions.ts:147`.
- The client calls `await submitGeneralExpense(formData)` and immediately shows success without checking `result.success`: `src/app/(dashboard)/finance/expenses/client.tsx:74` and `src/app/(dashboard)/finance/expenses/client.tsx:76`.

Impact:

Users can receive "Expense recorded successfully" for validation, FK, unsupported account, locked-period, or database failures. This corrupts operator trust even if the DB transaction rolled back.

Recommended fix:

Have the client inspect the returned `ActionResponse`. Show success only when `result.success === true`; otherwise show `result.error`. Keep the existing server action response pattern.

### F-02: Company expense payment account validation is unsafe and can create wrong business postings

Severity: High

Evidence:

- The server schema accepts `paymentAssetAccountCode` as arbitrary string: `src/app/(dashboard)/finance/expenses/actions.ts:26`.
- It is cast to `LedgerAccountCode` before posting: `src/app/(dashboard)/finance/expenses/actions.ts:135`.
- `recordGeneralExpense` credits whatever account code is passed as the payment asset: `src/lib/finance/expenses.ts:79`.
- The authoritative cash account SSoT is `CASH_ACCOUNT_CODES`: `src/lib/domain/finance.ts:55`.

Impact:

A malformed request can credit non-cash accounts such as `accounts_receivable`, `accounts_payable_general`, or income/expense accounts. The ledger stays mathematically balanced, but the business meaning is wrong.

Recommended fix:

Validate `paymentAssetAccountCode` against `CASH_ACCOUNT_CODES` on the server. Do not cast a free string. Use `z.enum(CASH_ACCOUNT_CODES)` or a shared schema.

### F-03: Company expense payment method and asset account can disagree

Severity: High

Evidence:

- Active payment methods are fetched and displayed from `paymentMethods`: `src/app/(dashboard)/finance/expenses/actions.ts:78`.
- The UI separately lets users choose a source asset account: `src/app/(dashboard)/finance/expenses/client.tsx:312`.
- The payment method SSoT maps each method to a ledger asset account, for example `kbz_pay -> kbz_wallet`: `src/lib/domain/payment.ts:25`.

Impact:

A user can choose "KBZPay" as payment method and "Cash on Hand" as the credited asset. The expense record says one payment method while the ledger credits another. Project expenses avoid this by deriving the asset account from the payment method.

Recommended fix:

For paid general expenses, derive `paymentAssetAccountCode` server-side from the selected payment method via the existing payment-method ledger map, or validate the submitted asset matches the mapped account.

### F-04: Wallet payment methods cannot be correctly selected in the current expense form

Severity: Medium

Evidence:

- Payment method presets include wallet methods and map them to wallet accounts: `src/lib/domain/payment.ts:10` and `src/lib/domain/payment.ts:25`.
- The general expense source asset dropdown only offers cash and bank accounts, not `kbz_wallet`, `aya_wallet`, `cb_wallet`, or `wave_wallet`: `src/app/(dashboard)/finance/expenses/client.tsx:312`.

Impact:

Daily wallet-paid expenses cannot be represented accurately through the current UI. Users either cannot post the expense correctly or must choose an incorrect cash/bank account.

Recommended fix:

Either remove the manual asset dropdown and derive from payment method, or populate it from `CASH_ACCOUNT_CODES` so wallets are available.

### F-05: Finance dashboard cached values are stale after financial writes

Severity: High

Evidence:

- Finance summary, monthly trend, and expense breakdown are cached with tag `finance` and 300 second revalidation: `src/actions/finance-dashboard-actions.ts:57`, `src/actions/finance-dashboard-actions.ts:243`, `src/actions/finance-dashboard-actions.ts:289`, `src/actions/finance-dashboard-actions.ts:364`, `src/actions/finance-dashboard-actions.ts:393`, `src/actions/finance-dashboard-actions.ts:423`.
- General expense submission only revalidates `/finance/expenses`: `src/app/(dashboard)/finance/expenses/actions.ts:144`.
- Project cost writes revalidate projects but not the `finance` cache tag: `src/actions/project-actions.ts:1163`.
- Project payment writes revalidate projects but not the `finance` cache tag: `src/actions/payment-actions.ts:190`.

Impact:

After recording an expense, project cost, payment, invoice, or transfer, the dashboard may show old totals for up to five minutes. This is especially visible for new general/company expenses because the expense page itself updates while `/finance` summary cards do not.

Recommended fix:

Introduce a finance cache invalidation helper that revalidates the `finance` tag plus affected finance paths. Call it from all ledger-writing actions.

### F-06: Cash flow beginning cash double-counts entries on the report start date

Severity: High

Evidence:

- Period activity includes entries where `entryDate >= dateFrom`: `src/actions/cash-flow-actions.ts:83`.
- Beginning cash includes entries where `entryDate <= dateFrom`: `src/actions/cash-flow-actions.ts:221`.
- Ending cash is `beginningCash + netCashChange`: `src/actions/cash-flow-actions.ts:231`.

Impact:

Any cash movement exactly on the selected start date is included in both beginning cash and period cash flow. Ending cash becomes overstated or understated by that start-date cash movement.

Recommended fix:

Use `< dateFrom` for beginning cash, or set `dateFrom` to start-of-day and compute beginning cash strictly before that timestamp.

### F-07: Cash flow excludes general/company expenses from operating activities

Severity: High

Evidence:

- `general_expense` is a valid journal source type: `src/lib/db/schema.ts:128`.
- Operating cash-flow source types do not include `general_expense`: `src/lib/domain/finance.ts:231`.
- Cash flow only labels project payment, supplier payment, project expense, and manual adjustment; everything else becomes a generic line if categorized: `src/actions/cash-flow-actions.ts:154`.

Impact:

Paid company expenses affect cash balances, P&L, and balance sheet, but are not classified as operating cash outflows. They may fall into financing or a generic bucket depending on the source-type classification.

Recommended fix:

Add `general_expense` to operating source types and label it as "Company Expenses" or "Operating Expenses". Keep accrued-only expenses out of cash flow until paid, because they have no cash line.

### F-08: Balance Sheet and Trial Balance `dateAsOf` filters exclude same-day activity

Severity: High

Evidence:

- Balance Sheet parses a `YYYY-MM-DD` string directly with `parseISO`, which produces start-of-day: `src/actions/balance-sheet-actions.ts:60`.
- It filters `entryDate <= dateAsOf`: `src/actions/balance-sheet-actions.ts:74`.
- Trial Balance has the same pattern: `src/actions/trial-balance-actions.ts:41` and `src/actions/trial-balance-actions.ts:56`.

Impact:

Choosing an as-of date such as `2026-06-06` excludes ledger entries later on June 6, 2026. Reports understate balances for the selected date.

Recommended fix:

When `dateAsOf` is provided as a date-only value, use `endOfDay(parseISO(dateAsOf))`.

### F-09: Expense "YTD" total is actually the sum of the latest 50 records

Severity: Medium

Evidence:

- `getExpensesData` fetches recent expenses with `limit: 50`: `src/app/(dashboard)/finance/expenses/actions.ts:62`.
- The UI labels the total "YTD Expenses": `src/app/(dashboard)/finance/expenses/client.tsx:133`.
- The total sums only `data.expenses`: `src/app/(dashboard)/finance/expenses/client.tsx:84`.

Impact:

The displayed YTD total is wrong once there are more than 50 expenses or if records are from different years.

Recommended fix:

Either rename the label to "Recent Expenses" or query a real year-to-date aggregate separately.

### F-10: Data consistency checks are project-only but labeled as global expense checks

Severity: Medium

Evidence:

- Dashboard data consistency compares journal expenses from only `project_expense` and `inventory_consumption`: `src/actions/finance-dashboard-actions.ts:597`.
- It compares those to only `projectCosts`: `src/actions/finance-dashboard-actions.ts:608`.
- Month-end close has the same project-cost scope: `src/actions/month-end-close-actions.ts:99` and `src/actions/month-end-close-actions.ts:167`.

Impact:

Once company expenses are added, the dashboard and month-end close can imply that all expenses are reconciled while company expenses are not part of the control. If this is intended, the labels are misleading. If not intended, the control is incomplete.

Recommended fix:

Decide the control scope explicitly:

- Project-only: rename labels to "Project Costs".
- Global expense control: include `general_expenses` and `general_expense` journals in a separate reconciliation line.

### F-11: General/company expenses have no exposed payment flow for accrued liabilities

Severity: Medium

Evidence:

- `recordGeneralExpense` can create accrued expenses by crediting `accounts_payable_general`: `src/lib/finance/expenses.ts:105`.
- `payGeneralExpense` exists and reverses the payable into cash payment: `src/lib/finance/expenses.ts:127`.
- There is no server action or UI path calling `payGeneralExpense`; route search finds only submit/list usage in `/finance/expenses`.

Impact:

Users can create unpaid company expenses, but cannot settle them through the visible workflow. The liability can remain stuck unless an admin uses a manual journal, which bypasses the intended subledger state update.

Recommended fix:

Add a scoped server action and UI control to pay an existing accrued general expense, using the existing helper and same payment-method mapping rules.

### F-12: Company expenses route exists but is not reachable from main finance navigation

Severity: Medium

Evidence:

- The route `/finance/expenses` exists: `src/app/(dashboard)/finance/expenses/page.tsx:10`.
- Finance dashboard has buttons for transfer and reports, but no visible link to expenses: `src/app/(dashboard)/finance/finance-dashboard-client.tsx:158` and `src/app/(dashboard)/finance/finance-dashboard-client.tsx:164`.
- Main navigation points only to `/finance`: `src/components/layout/nav-orbit.tsx:42`.
- Command bar routes only to `/finance`: `src/components/layout/command-bar.tsx:194`.
- Navigation route test only covers `/finance` and `/finance/ledger`: `src/app/(dashboard)/navigation-routes.test.ts:16`.

Impact:

The feature exists but is effectively hidden unless a user knows the direct URL. This likely explains the user-facing perception that expenses can only be added through active projects.

Recommended fix:

Add a finance dashboard action card/button and command route for `/finance/expenses`. This is discoverability, not a new accounting feature.

### F-13: Reversals use today's date instead of the original entry date or caller-selected reversal date

Severity: Medium

Evidence:

- `reverseJournalEntry` creates the reversal with `entryDate: new Date()`: `src/lib/finance/ledger.ts:283`.
- It checks accounting-period locks through `createBalancedJournalEntry`, but only for the reversal date.

Impact:

Deleting a historical cost reverses it in the current period instead of the period where the correction belongs. That may be desired for closed-period accounting, but the code provides no caller choice and no documented policy. Reports for historical months remain showing the original cost until the current-month reversal offsets it.

Recommended fix:

Document the policy. If the business expects correction in the original period, pass a reversal date and enforce period locks. If the business expects current-period reversals, surface that in UI/report labels.

## Positive Controls Already Present

- Journal line validation exists both in server code and DB checks.
- Journal entries are immutable by policy and reversed through a reversal helper.
- Period locks are checked before journal posting.
- Ledger accounts are SSoT-driven and auto-seeded when posting.
- Project costs cannot be added to on-hold, installation-completed, completed, or cancelled projects.
- Project final payments cannot exceed open A/R.
- Inventory consumption posts COGS and reduces raw materials through the ledger.

## Company Expense Feature Plan

### Goal

Allow company-level expenses without requiring an active project, while preserving double-entry accounting and keeping project profitability separate from company overhead.

Examples:

- Daily expenses
- Salary and payroll
- Electricity bills
- Rent
- Office supplies
- Software subscriptions
- Taxes
- General overhead

### Non-Goals

- Do not merge company overhead into project profitability.
- Do not bypass the ledger with direct balance updates.
- Do not add a new accounting model.
- Do not weaken TypeScript strictness or SSoT account mapping.

### Recommended Accounting Treatment

Paid immediately:

```text
Dr Operating Expense Account
Cr Cash/Bank/Wallet Account
```

Accrued/unpaid:

```text
Dr Operating Expense Account
Cr Accounts Payable - General
```

Payment of accrued expense:

```text
Dr Accounts Payable - General
Cr Cash/Bank/Wallet Account
```

Account mapping:

- Daily/misc: `misc_expense` or `general_expense`
- Salary: `payroll_expense`
- Electricity: `utilities_expense`
- Rent: `rent_expense`
- Office items: `office_supplies`
- Software: `software_subscriptions`
- Taxes: `tax_expense`

### Data Model

Use the existing `general_expenses` table. It already has the right separation from `project_costs`.

Recommended minimal additions only if needed:

- `paidAt` timestamp for settlement audit.
- `journalEntryId` or separate link table if fast traceability from expense record to journal is required.

Do not add `projectId` to `general_expenses`; project-bound costs already belong in `project_costs`.

### Server Actions

1. Harden `submitGeneralExpense`.
   - Validate `expenseAccountCode` against `OPERATING_EXPENSE_ACCOUNT_CODES`.
   - Validate payment account against `CASH_ACCOUNT_CODES`, or derive it from payment method.
   - Confirm `paymentMethodId` exists and is active.
   - Revalidate finance dashboard cache tag and relevant paths.

2. Add `payGeneralExpenseAction`.
   - Accept `expenseId`, `paymentMethodId`, `paymentDate`, `reference`, `notes`.
   - Resolve the cash/bank/wallet account from payment method.
   - Call existing `payGeneralExpense`.
   - Revalidate `/finance/expenses`, `/finance`, `/finance/ledger`, cash flow, P&L, balance sheet.

3. Add consistent action response handling.
   - Client must treat `success: false` as failure.

### UI Workflow

1. Add an obvious entry point.
   - Add "Company Expenses" button/card on `/finance`.
   - Add command-bar route.
   - Add navigation route test coverage.

2. Improve the `/finance/expenses` form.
   - Use payment method as the single source for the credited asset.
   - Show the resolved asset account as read-only helper text.
   - Keep "Paid Immediately" and "Accrue Liability" modes.
   - For accrued rows, show a "Pay" action.

3. Correct the list and totals.
   - Show recent expenses separately from aggregate totals.
   - Add true YTD aggregate if keeping the YTD label.
   - Show ledger status: paid, accrued, paid later.

### Reporting Updates

1. P&L:
   - Already mostly works because it reads expense account types.
   - Verify general expense accounts appear in operating expense lines.

2. Finance dashboard:
   - Ensure cache invalidation after all ledger writes.
   - Expense breakdown should include company expenses.

3. Cash Flow:
   - Add `general_expense` to operating activities.
   - Label paid company expenses clearly.
   - Fix beginning cash boundary.

4. Balance Sheet and Trial Balance:
   - Fix date-only as-of filtering to include the full selected day.
   - Verify accrued expenses increase `accounts_payable_general`.

5. Month-End Close:
   - Add either a separate "Company expenses posted" check or rename project-only checks.

### Tests

Add or update focused tests:

- `recordGeneralExpense` paid path posts debit expense and credit mapped cash account.
- `recordGeneralExpense` accrued path posts debit expense and credit `accounts_payable_general`.
- `payGeneralExpense` posts debit `accounts_payable_general` and credit mapped cash account, and rejects already-paid expenses.
- Server action rejects invalid payment asset account.
- Client handles `success: false` without success toast.
- Cash flow includes paid general expense in operating outflows.
- Cash flow beginning cash excludes period-start transactions.
- Balance Sheet and Trial Balance include entries on the selected as-of date.
- Finance cache invalidation helper is called by general expense, project cost, payment, invoice, transfer, supplier payment, and manual journal writes.

### Rollout Sequence

1. Fix correctness bugs that affect existing finance reports and current `/finance/expenses`.
2. Add finance cache invalidation helper and apply it to all ledger-writing actions.
3. Harden general expense validation and client action handling.
4. Expose `/finance/expenses` from dashboard/nav/command.
5. Add accrued-expense payment action and UI.
6. Update reports and tests.
7. Run `pnpm typecheck`, relevant unit tests, and finance E2E smoke tests.

## Suggested Verification Commands

```powershell
pnpm typecheck
pnpm test src/lib/finance/__tests__/ledger-invariants.test.ts
pnpm test src/actions/finance-dashboard-actions.test.ts
pnpm test src/actions/month-end-close-actions.test.ts
pnpm exec playwright test e2e/finance.spec.ts
```
