# BOB Solar Improvement Plan (2026-05-16)

## Scope and Goal

Prepare the app for release in 3-4 days (target: **May 19-20, 2026**) by making project progression clearer, adding customer-facing project completion vouchers, defining payment and finance foundations, removing risky git hook steps, and adding a safe factory reset flow for clean handoff data.

## Current Gaps (Validated)

1. Quotation flow is good and PDF export works.
2. Accepted quotation should clearly start project lifecycle, but current state-change UX relies too much on dropdown patterns.
3. No customer voucher flow for completed projects / final payment handover.
4. No wallet/payment-method model.
5. No finance ledger/reporting baseline.
6. Git hook currently runs `pnpm db:seed` on push (removed now from `.husky/pre-push`).
7. No one-command factory reset workflow for cleaning test data before handoff.

## Product and UX Decisions

1. Keep this as a **single-company, 3-user** operational app (no enterprise over-design).
2. Replace critical workflow dropdowns with a **guided state rail** component for project lifecycle actions.
3. Keep money as **integer MMK** everywhere (no floating point).
4. Keep quote acceptance as the project kickoff trigger:
   - `accepted` quotation -> create project in `planning`
5. Expose clear next actions at each stage:
   - `planning` -> `in_progress` -> `final_review` (middle state) -> `completed`

## Technical Plan (2026 Pattern Aligned)

### 1) Workflow UX Refactor (High Priority)

1. Build `ProjectStateRail` (server-validated action buttons, not dropdown).
2. Show only valid transitions and disable invalid ones with reason text.
3. Emit activity/notification events on every transition.
4. Add optimistic UI using TanStack Query v5 mutation patterns (`isPending`, rollback-safe updates).

### 2) Voucher System for Completed Projects (High Priority)

1. Add `project_vouchers` table:
   - `id`, `project_id`, `voucher_number`, `voucher_type`, `issued_at`, `total_amount`, `paid_amount`, `balance_amount`, `notes`, `created_by`
2. Voucher types:
   - `completion_certificate`
   - `final_payment_voucher`
3. Add voucher number generator:
   - `VC-{YEAR}-{0001..9999}`
4. Build printable HTML voucher pages (same browser print approach used by quotation PDF flow).
5. Add buttons on completed project screen:
   - `Generate Completion Voucher`
   - `Generate Final Payment Voucher`

### 3) Payment Method and Wallet Foundation (Medium Priority)

1. Add `payment_methods` table (cash/bank transfer/mobile wallet/other).
2. Add `project_payments` table linked to project + voucher.
3. Track cumulative paid amount and outstanding balance by project.
4. Enforce integer MMK validations with Zod v4.

### 4) Finance Baseline (Medium Priority)

1. Add lightweight ledger view from `project_payments` + `project_costs`:
   - incoming, outgoing, net by month
2. Add export-ready summary page (no full accounting suite).
3. Add alert for completed projects with unpaid balance > 0.

### 5) Factory Reset / DB Reset (High Priority)

1. Add explicit scripts:
   - `db:reset` -> reset schema + migrate + optional reseed
   - `db:factory-reset` -> reset + migrate + minimal clean bootstrap data only
2. Require confirmation token (`--confirm=RESET`) to prevent accidental data loss.
3. Provide `docs/quality_scripts.md` update with exact safe usage.

## Implementation Sequence (Release Window)

### Day 1 (May 16-17)

1. Workflow UX refactor (state rail + transition guards).
2. Project state tests (unit + integration).

### Day 2 (May 17-18)

1. Voucher schema + server actions + printable voucher pages.
2. Completed-project CTA integration.

### Day 3 (May 18-19)

1. Payment method + payment records + balance computation.
2. Finance baseline dashboard card/list.
3. DB reset/factory reset scripts.

### Day 4 Buffer (May 19-20)

1. Bug fixes, polish, smoke tests.
2. Final data cleanup using `db:factory-reset`.

## Quality Gates

1. `pnpm typecheck`
2. `pnpm lint`
3. `pnpm build`
4. Focus tests:
   - quotation accepted -> project created in `planning`
   - allowed/blocked project transitions
   - voucher number uniqueness
   - payment balance math (integer MMK)
   - factory reset safety checks

## Acceptance Criteria

1. No dropdown-only critical state transition path for projects.
2. Users can generate and print completion/final-payment vouchers from completed projects.
3. Payment entries update project outstanding balance correctly.
4. Basic finance summary is visible and consistent with payment/cost records.
5. Team can clean all test data safely with a documented reset command.
6. CI/local gates pass and app is deploy-ready before May 20, 2026.
