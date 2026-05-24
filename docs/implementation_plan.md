# Implementation Plan - Pre-Release Bug Fixes

We will implement the required fixes for the bugs and SSoT drifts identified in the Pre-Release Audit report ([PreRelease_Audit.md](file:///c:/bobsolar/docs/PreRelease_Audit.md)).

## User Review Required

> [!IMPORTANT]
> **Database Schema Changes**: This plan includes deprecating the duplicate `role` column in the `sessions` table and adding a unique constraint to the `name` column in the `payment_methods` table. These changes require generating and running a new database migration.
>
> **Fractional Quantities Support**: The quantity validator inside `quotationItemSchema` will be changed from integer to decimal, and the Zustand state store will allow up to two decimal places. Downstream pricing logic has been verified to be compatible with floats.

## Open Questions

None. The audit recommendations are clear, targeted, and low-risk.

## Proposed Changes

---

### Component: Core Domain & Enums

#### [MODIFY] [enums.ts](file:///c:/bobsolar/src/lib/domain/enums.ts)
Remove re-exports of `PROJECT_EXPENSE_TYPES`, `ProjectExpenseType`, and `projectExpenseTypeSchema` as they are dead-weight declarations replaced by `COST_TYPES` and `CostType`.

#### [MODIFY] [finance.ts](file:///c:/bobsolar/src/lib/domain/finance.ts)
Delete the unused declarations:
- `PROJECT_EXPENSE_TYPES`
- `ProjectExpenseType`
- `projectExpenseTypeSchema`

---

### Component: Database Schema & Seeding

#### [MODIFY] [schema.ts](file:///c:/bobsolar/src/lib/db/schema.ts)
1. Remove `role: text("role").notNull()` from `sessions` table definition.
2. Add `.unique()` constraint to `name` in `paymentMethods` table definition.

#### [MODIFY] [factory-bootstrap.ts](file:///c:/bobsolar/src/lib/db/factory-bootstrap.ts)
Update `paymentMethods` seed block to explicitly target the `name` column on conflict:
```typescript
await db.insert(paymentMethods).values(method).onConflictDoNothing({ target: paymentMethods.name });
```

---

### Component: Authentication & Session Management

#### [MODIFY] [session.ts](file:///c:/bobsolar/src/lib/auth/session.ts)
Remove the `role` parameter from the `createSession` function and its insert call to `sessions` table.

#### [MODIFY] [auth-actions.ts](file:///c:/bobsolar/src/actions/auth-actions.ts)
Remove the `parsedRole` extraction and parsing, and do not pass `role` when calling `createSession`.

---

### Component: Inventory Brand/Model Sync

#### [MODIFY] [inventory-actions.ts](file:///c:/bobsolar/src/actions/inventory-actions.ts)
In `createInventoryItem` and `updateInventoryItem`, copy/extract the brand and model from `specifications.brandModel` if the category is `panel`, `inverter`, or `battery` to keep the DB table columns in sync with specifications.

#### [MODIFY] [inventory-dialog.tsx](file:///c:/bobsolar/src/components/inventory/inventory-dialog.tsx)
In `onSubmit`, ensure the brand and model are copied from `specifications.brandModel` when the category is a panel, inverter, or battery, maintaining client-side submission alignment.

---

### Component: Quotation Quantity & Zustand Store

#### [MODIFY] [quotation.ts](file:///c:/bobsolar/src/lib/validators/quotation.ts)
Update `quotationItemSchema` to change `quantity` from `z.number().int()` to `z.number().positive()`.

#### [MODIFY] [quote-builder-store.ts](file:///c:/bobsolar/src/stores/quote-builder-store.ts)
Update the store to allow decimal quantities up to two decimal places in both `updateItem` and `updateItemQuantity`:
```typescript
Math.max(0.01, Math.round(quantity * 100) / 100)
```

---

### Component: Manual Journal Schema Validation

#### [MODIFY] [manual-journal.ts](file:///c:/bobsolar/src/lib/validators/manual-journal.ts)
Convert `.refine()` to `.superRefine((data, ctx) => ...)` and add Zod issues to the context instead of returning helper objects, so that validation error checking is no longer bypassed.

---

## Verification Plan

### Automated Tests
1. **Schema Migrations**:
   Run the following commands to generate and push/apply migrations:
   ```bash
   pnpm exec drizzle-kit generate
   pnpm db:migrate:test
   ```
2. **Validator Tests**:
   Create a new test file [manual-journal.test.ts](file:///c:/bobsolar/src/lib/validators/__tests__/manual-journal.test.ts) to test manual journal entries validation.
   Run existing validator, store, and workflow tests:
   ```bash
   pnpm green:code
   pnpm test:db
   ```

### Manual Verification
1. Verify database integrity after running migrations.
2. Verify that manual journal entries with unbalanced amounts fail validation correctly.
3. Verify that inventory items for panels, batteries, and inverters correctly populate both table columns (`brand`, `model_number`) and specifications JSONB field.
4. Verify that decimal values can be entered for quotation item quantities (e.g. 5.5 meters of cable).
