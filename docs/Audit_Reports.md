# Audit Reports

Date: 2026-05-19
Repo: `C:\bobsolar`
Reference SSoT docs:
- `docs/strict-ts-biome-lefthook-finance-plan.md`
- `docs/finance_system_ProgressLog.md`

## Verification Snapshot
- `pnpm typecheck`: passed
- `pnpm lint`: passed
- `pnpm test`: passed (20 files passed, 3 skipped)
- `pnpm build`: passed
- Legacy hook artifact check: `.husky` directory not found

## Remediation Applied (This Turn)

### Fixed 1) Rate-limit on login (Critical)
Evidence now:
- `src/actions/auth-actions.ts` now enforces:
  - per-email rate key (`login:<email>`)
  - attempt window tracking
  - lockout after max attempts
  - lock reset on successful login
- Uses existing table: `src/lib/db/schema.ts` (`auth_rate_limits`)

### Fixed 3) Outstanding Receivables logic (High)
Evidence now:
- `src/actions/dashboard-actions.ts` quick-view receivable query now computes:
  - per-project outstanding = `quotedTotal - paidAmount`
  - count only outstanding > 0
  - amount sums only positive outstanding

### Fixed 4) `general_expense` omission in finance dashboard (Medium)
Evidence now:
- `src/actions/finance-dashboard-actions.ts` includes `general_expense` in:
  - summary expense aggregation
  - monthly trend expense aggregation
  - expense breakdown aggregation + label map

### Fixed 5) Activity polling load spike (Medium)
Evidence now:
- `src/hooks/use-dashboard.ts` changed from 30s polling to 2-minute polling for `useRecentActivity()`.

### Fixed 6) Tooling docs drift (Medium)
Evidence now:
- `docs/quality_scripts.md` updated to remove Oxlint wording and reflect Biome-only lint stack.

## Additional Applied Alignment

### User-role policy aligned to owner-only current reality
Evidence:
- `src/actions/settings-actions.ts`: newly created users are now `role: "admin"`.
- `src/lib/domain/policies.ts`: `USER_CAP` set to `3`.

Note:
- Existing users that are still `staff` must be promoted once in DB to fully match your current 3-owner policy.

## Remaining Open Decision

### 2) RBAC policy clarity vs docs wording
Current reality:
- Some finance-impacting operational actions still use `requireAuth()` (not `requireFinanceAccess()`), which can be valid if all 3 users are owners/admins.

Decision to lock in:
- Keep RBAC model (recommended) and ensure all 3 users are admin.
- Update SSoT wording so it no longer claims a stricter runtime model than implemented, or tighten those actions to `requireFinanceAccess()` if you want hard separation.

## UX Refactor Applied

### Warranty page grouped by project cards
Evidence:
- `src/app/(dashboard)/warranty/page.tsx`
  - Alerts now grouped by project card.
  - Click "Show details" to expand project-specific warranty item list.
  - Resolve/Reopen actions available per item inside expanded card.

## Next Large Feature Gaps (Not Yet Implemented)

1. Inventory-to-project cost realization flow:
- Inventory stock movement should create project-cost postings when actually used on a project (not on inventory put/add).

2. Per-project profitability ledger:
- Completed project detail should show:
  - quoted revenue
  - received payment
  - inventory-consumed cost
  - additional expense cost
  - gross/net profit

3. Finance SSoT doc consistency sweep:
- `docs/finance_system_ProgressLog.md` should be updated to reflect final chosen RBAC behavior and current implementation boundaries.

---

Date: 2026-05-20

## Remediation Applied (This Turn)

### 1) RBAC policy lock: finance-sensitive actions are admin-only
Evidence now:
- `src/actions/project-actions.ts`
  - `addProjectCost()` now requires `requireFinanceAccess()`.
  - `deleteProjectCost()` now requires `requireFinanceAccess()`.
  - New `consumeProjectInventory()` requires `requireFinanceAccess()`.

### 2) One-time role cleanup script (idempotent)
Evidence now:
- Added `scripts/promote-staff-admin.ts`.
- Added package script: `pnpm db:promote-staff-admin`.
- Script behavior:
  - promotes all `users.role='staff'` to `admin`
  - logs promoted rows
  - safe to rerun (idempotent when no staff remains).

### 3) Auth lockout test coverage completed
Evidence now:
- Added `src/__tests__/auth-login-lockout.test.ts`:
  - lock after max failed attempts
  - block during lock window
  - clear lock row on successful login.

### 4) Inventory -> Project Expense flow (separate explicit action)
Evidence now:
- Added validator: `consumeProjectInventorySchema` in `src/lib/validators/project.ts`.
- Added action: `consumeProjectInventory()` in `src/actions/project-actions.ts`.
- Added UI action in project detail:
  - "Consume inventory" sheet in `src/app/(dashboard)/projects/[id]/project-detail-shell.tsx`.
- Behavior:
  - validates project + inventory + quantity
  - blocks insufficient stock
  - decrements `inventory_items.stock_qty`
  - creates `project_costs` row
  - posts balanced journal entry with `sourceType='project_expense'`.

### 5) Completed-project profitability view added
Evidence now:
- `getProject()` now returns `profitability` payload:
  - `quotedRevenue`
  - `receivedPayment`
  - `inventoryConsumedCost`
  - `additionalCosts`
  - `netProfit`
- UI section rendered for completed projects in:
  - `src/app/(dashboard)/projects/[id]/project-detail-shell.tsx`.

### 6) Integration test coverage for consume flow and profitability
Evidence now:
- Updated `src/__tests__/db-workflow-master.test.ts`:
  - success path consumes inventory and decreases stock
  - insufficient stock fails without additional decrement
  - invalid project consume fails
  - profitability fields verified for mixed inventory + additional costs.
