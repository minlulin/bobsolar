# Massive Test Coverage Expansion & Autosave Fixes

We need to massively expand test coverage across the application (specifically targeting 0% covered actions and the finance core) and resolve the Quote Builder autosave bug.

## User Review Required

> [!WARNING]
> This plan involves generating hundreds of test cases for more than 15 separate modules. Because this is a massive undertaking, I will structure the execution into focused batches (e.g., Autosave & Stores first, then Finance, then remaining Actions) to ensure quality and prevent timeout/context limits.

## Open Questions

- Should I mock the database layer for all new test suites (like we do in `customer-actions.test.ts`), or do you prefer using a live database for these "ugly" tests? *I recommend deep mocking to ensure the tests run quickly and reliably without DB state bleeding, but I will simulate DB failures (ugly tests) through the mocks.*

## Proposed Changes

### 1. Quote Builder Autosave Fix

The `use-quote-autosave.ts` hook has a severe race condition:
- It uses a `useRef` to store the `serverDraftId` after an autosave creates a draft quotation in the DB.
- Because mutating a ref does not trigger a React re-render, the parent component (`quote-editor.tsx`) is unaware that the draft was created.
- If the user clicks "Save Draft" manually before the component re-renders, the manual save logic sees `serverDraftId` as `null` and attempts to `createQuotation` again, resulting in duplicate quotations.

#### [MODIFY] [use-quote-autosave.ts](file:///c:/bobsolar/src/hooks/use-quote-autosave.ts)
- Change `serverDraftIdRef` to a React `useState` to ensure the parent component re-renders and receives the latest database ID.
- Alternatively, expose an `isSaving` state and prevent manual saves while an autosave is in flight.

### 2. Store Test Coverage (11% -> >90%)

#### [MODIFY] [quote-builder-store.test.ts](file:///c:/bobsolar/src/stores/quote-builder-store.test.ts)
- Add tests for `addItem`, `addCustomItem`, `removeItem`, `updateItem`, `setDiscount`, and `loadFromAutosaveDraft`.
- Add tests for negative inputs (e.g., negative quantities, invalid discounts).

#### [NEW] [notification-store.test.ts](file:///c:/bobsolar/src/stores/notification-store.test.ts)
- Add tests for the Zustand store handling notifications (add, mark as read, clear).

### 3. Finance & General Actions Test Coverage (0% -> >90%)

I will create comprehensive, fully-mocked test suites for the following action modules. Each suite will test "happy paths" as well as "ugly tests" (e.g., auth failures, DB failures, invalid UUIDs, zero-balance edge cases).

#### [NEW] [backup-actions.test.ts](file:///c:/bobsolar/src/actions/backup-actions.test.ts)
#### [NEW] [balance-sheet-actions.test.ts](file:///c:/bobsolar/src/actions/balance-sheet-actions.test.ts)
#### [NEW] [budget-actions.test.ts](file:///c:/bobsolar/src/actions/budget-actions.test.ts)
#### [NEW] [cash-flow-actions.test.ts](file:///c:/bobsolar/src/actions/cash-flow-actions.test.ts)
#### [NEW] [cash-transfer-actions.test.ts](file:///c:/bobsolar/src/actions/cash-transfer-actions.test.ts)
#### [NEW] [ledger-actions.test.ts](file:///c:/bobsolar/src/actions/ledger-actions.test.ts)
#### [NEW] [manual-journal-actions.test.ts](file:///c:/bobsolar/src/actions/manual-journal-actions.test.ts)
#### [NEW] [monitoring-actions.test.ts](file:///c:/bobsolar/src/actions/monitoring-actions.test.ts)
#### [NEW] [payable-aging-actions.test.ts](file:///c:/bobsolar/src/actions/payable-aging-actions.test.ts)
#### [NEW] [purchase-actions.test.ts](file:///c:/bobsolar/src/actions/purchase-actions.test.ts)
#### [NEW] [receivable-aging-actions.test.ts](file:///c:/bobsolar/src/actions/receivable-aging-actions.test.ts)
#### [NEW] [trial-balance-actions.test.ts](file:///c:/bobsolar/src/actions/trial-balance-actions.test.ts)
#### [NEW] [voucher-actions.test.ts](file:///c:/bobsolar/src/actions/voucher-actions.test.ts)

### 4. Auth Coverage (42% -> >90%)

#### [MODIFY] [auth-actions.more.test.ts](file:///c:/bobsolar/src/actions/auth-actions.more.test.ts)
- Add tests covering the remaining untested sessions, constants, and migration edge cases in the auth domain.

## Verification Plan

### Automated Tests
- `pnpm test:code` to verify that all new tests pass and no existing tests regress.
- `pnpm vitest run --coverage` (if configured) to measure and verify the coverage increases for the target files.
