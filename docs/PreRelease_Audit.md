# Pre-Release Architecture & Type System Audit
**Project:** BOB Solar (Next.js 15+ & TypeScript Strict-Mode Ecosystem)  
**Date:** May 2026  
**Auditor:** Senior Staff Engineer & Enterprise Code Auditor  

---

# Executive Summary

## Overall Architecture Health
The BOB Solar codebase demonstrates a robust and highly structured full-stack Next.js architecture. The project correctly utilizes modern features, including Server Actions, centralized domain-driven enums, and structured database transactions using Drizzle ORM. Type safety is strictly enforced across the system, and security controls (such as CSRF checks and content-type verification in the file upload API) are well-implemented. 

However, a deep audit of the validation logic, persistence contracts, and domain abstractions revealed several areas of **Single Source of Truth (SSoT) drift** and a **critical validation logic failure** that could compromise financial data integrity in production.

## Estimated Risk Level
> [!WARNING]
> **Risk Level: HIGH**  
> While the codebase has strong TypeScript types and robust database check constraints, the validation logic failure in the manual journal schema allows unbalanced double-entry bookkeeping entries to bypass API validation. This presents a high risk of financial ledger inconsistencies if database writes bypass the service layer or fail to trigger service-level exceptions.

## Main SSoT Drift Areas
1. **Financial Ledger Inconsistencies (Zod Validation Mismatch):** The Zod schema validator for manual journal entries is completely bypassed due to incorrect refinement syntax, delegating safety entirely to the transaction level.
2. **Ignored Database Columns (Brand & Model Number):** Category-specific specs for panels, inverters, and batteries bypass dedicated table columns (`brand`, `model_number`) and store properties inside JSONB, rendering SQL index searches ineffective.
3. **Decimals vs. Integers Constraints:** The database utilizes `decimal` columns to store quantities and values (supporting fractions), but validators and frontend states coerce all quantities and costs to integers. This makes fractional measurements (e.g., fractional cable lengths in meters) impossible.
4. **Session Role Duplication:** User roles are stored in both the `sessions` table and the `users` table, but the authorization helper only queries the `users` table, leaving `sessions.role` as dead-weight state.

---

# Audit Rules Applied

- **TypeScript Strictest-Mode Expectations:** All type definitions must have zero leakage, clean generics, and no unsafe casts (`as any`) in production paths.
- **Biome Strict Lint Expectations:** Strict verification of structural logic, avoiding mock objects or falsy returns where explicit boolean or schema types are expected.
- **Naming Consistency Expectations:** Matching schema column designations with input validators and client-side form names.
- **SSoT Validation Principles:** Core constraints (such as enums, structures, and relationships) must be defined in one authoritative location and propagated down to forms, APIs, and database definitions.

---

# Findings

## Finding ID: FND-001
### Severity
Critical

### Category
Logic Failure

### Description
The custom Zod validation callback for `manualJournalSchema` uses `.refine()` but returns helper objects (`{ success: false, error: ... }` and `{ success: true }`) instead of boolean primitives (`true`/`false`). 
In JavaScript/TypeScript, objects are truthy values. As a result, Zod interprets `{ success: false }` as `true` (successful validation). 

### Why It Is Risky
This logic failure completely disables validation for manual journal entries. Users can submit:
1. **Unbalanced Entries:** Where the sum of debits does not equal the sum of credits.
2. **Invalid Lines:** Lines that contain both debit and credit values, or neither.

While database check constraints (`journal_lines_single_side_check`) throw an error if a line is invalid, **there is no database-level check constraint to ensure the entry is balanced (debits = credits)**. Consequently, unbalanced journal entries will be successfully saved to the database, corrupting the financial ledger and violating standard accounting practices.

### Evidence
- **File Path:** [manual-journal.ts](file:///c:/bobsolar/src/lib/validators/manual-journal.ts#L22-L63)
- **Code Snippet:**
```typescript
  .refine(
    (data) => {
      let totalDebit = 0;
      let totalCredit = 0;
      let hasInvalidLine = false;

      for (const line of data.lines) {
        const hasDebit = line.debit > 0;
        const hasCredit = line.credit > 0;

        if ((hasDebit && hasCredit) || (!hasDebit && !hasCredit)) {
          hasInvalidLine = true;
        }

        totalDebit += Math.round(line.debit);
        totalCredit += Math.round(line.credit);
      }

      if (hasInvalidLine) {
        return {
          success: false,
          error: {
            message: "Each line must be debit-only or credit-only (not both, not neither)",
            path: ["lines"],
          },
        };
      }

      if (totalDebit !== totalCredit) {
        return {
          success: false,
          error: {
            message: `Entry is unbalanced: Debit ${totalDebit.toLocaleString()} ≠ Credit ${totalCredit.toLocaleString()}`,
            path: ["lines"],
          },
        };
      }

      return { success: true };
    },
    { message: "Journal entry validation failed" }
  );
```

### SSoT Conflict
The DTO validation schema (`manualJournalSchema`) is out of sync with the database and business logic constraints, leading to a silent pass of invalid requests.

### Recommended Minimal Fix
Convert the `.refine()` block to a `.superRefine()` block to correctly record Zod issues on the context:
```typescript
export const manualJournalSchema = z
  .object({
    entryDate: z.coerce.date(),
    memo: z.string().min(1, "Memo is required").max(500, "Memo must be under 500 characters"),
    sourceType: z.enum(JOURNAL_SOURCE_TYPES).default("manual_adjustment"),
    projectId: z.string().uuid().optional().nullable(),
    lines: z
      .array(journalLineSchema)
      .min(2, "Journal entry requires at least two lines")
      .max(20, "Maximum 20 lines per entry"),
  })
  .superRefine((data, ctx) => {
    let totalDebit = 0;
    let totalCredit = 0;
    let hasInvalidLine = false;

    for (const line of data.lines) {
      const hasDebit = line.debit > 0;
      const hasCredit = line.credit > 0;

      if ((hasDebit && hasCredit) || (!hasDebit && !hasCredit)) {
        hasInvalidLine = true;
      }

      totalDebit += Math.round(line.debit);
      totalCredit += Math.round(line.credit);
    }

    if (hasInvalidLine) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Each line must be debit-only or credit-only (not both, not neither)",
        path: ["lines"],
      });
    }

    if (totalDebit !== totalCredit) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Entry is unbalanced: Debit ${totalDebit.toLocaleString()} ≠ Credit ${totalCredit.toLocaleString()}`,
        path: ["lines"],
      });
    }
  });
```

### Refactor Risk
Safe. This is a targeted correction to the schema validator that aligns it with the existing `createBalancedJournalEntry` assertions.

---

## Finding ID: FND-002
### Severity
Medium

### Category
Schema Drift / SSoT Violation

### Description
The database `inventory_items` table contains dedicated `brand` and `model_number` columns. However, for core inventory categories (`panel`, `inverter`, `battery`), the frontend dialog bypasses these fields and stores brand/model attributes as a unified string (`brandModel`) inside a JSONB `specifications` column.

### Why It Is Risky
This pattern creates an SSoT drift where brand and model details are stored in two different places depending on the item category.
Furthermore, the search function in `getInventoryItems` executes SQL queries against the `brand` and `model_number` columns:
```typescript
      search
        ? or(
            ilike(inventoryItems.name, `%${search}%`),
            ilike(inventoryItems.brand, `%${search}%`),
            ilike(inventoryItems.modelNumber, `%${search}%`),
          )
        : undefined
```
Since `brand` and `model_number` are kept `null` for panels, inverters, and batteries, matching by brand or model number for these categories is impossible unless it happens to match the derived `name` column.

### Evidence
- **File Paths:**
  - [schema.ts](file:///c:/bobsolar/src/lib/db/schema.ts#L153-L155)
  - [inventory-dialog.tsx](file:///c:/bobsolar/src/components/inventory/inventory-dialog.tsx#L709-L752)
  - [inventory-actions.ts](file:///c:/bobsolar/src/actions/inventory-actions.ts#L28-L38)

### SSoT Conflict
The conceptual fields `brand` and `modelNumber` are split between table columns and a JSONB field, violating the Single Source of Truth for inventory properties.

### Recommended Minimal Fix
1. Modify `onSubmit` inside `InventoryDialog` to copy `brandModel` from the category-specific specs into the top-level `brand` or `modelNumber` columns before sending the payload.
2. Alternatively, keep both columns populated for all categories to ensure standard SQL index matching remains functional.

### Refactor Risk
Moderate. Changes must be coordinated between the dialog payload mapper and the persistence layer.

---

## Finding ID: FND-003
### Severity
Medium

### Category
Form Desynchronization / Type Drift

### Description
The database defines product quantity (e.g. `quantity` in `quotation_items`) and cost amounts as `decimal` columns supporting scale values (fractions). However, the Zod validators coerce all inputs to integers (`z.number().int()`), and the Zustand client store actively rounds quantities using `Math.round`.

### Why It Is Risky
1. **No Fractional Quantities:** Core units of measurement like `meter` (used for cables) or `kWp` (used for system size capacities) require fractional parts (e.g. `5.5 meters` of cable or `12.25 kWp`). The integer validator blocks these inputs, forcing users to input inaccurate values.
2. **Serialization Friction:** Because the database stores them as `decimal`, Drizzle represents these numbers as `strings` in TypeScript, requiring constant manual conversion (`Number()`, `.toString()`) across the application boundaries.

### Evidence
- **File Paths:**
  - [schema.ts](file:///c:/bobsolar/src/lib/db/schema.ts#L216)
  - [quotation.ts](file:///c:/bobsolar/src/lib/validators/quotation.ts#L11-L18)
  - [quote-builder-store.ts](file:///c:/bobsolar/src/stores/quote-builder-store.ts#L113-L124)

### SSoT Conflict
The database schema defines quantities as decimals (scale 2), while the Zod validator and the frontend state engine define them strictly as integers.

### Recommended Minimal Fix
1. Update `quotationItemSchema` to use `z.number().positive()` instead of `z.number().int()`.
2. Update the Zustand store quantity mutator to allow decimals up to two decimal places:
   ```typescript
   const sanitizedQuantity = Math.max(0.01, Math.round(quantity * 100) / 100);
   ```

### Refactor Risk
Moderate. Requires verifying that downstream pricing math (`calculateQuotation` in `src/lib/pricing/engine.ts`) correctly supports fractional multiplications.

---

## Finding ID: FND-004
### Severity
Low

### Category
Duplicate Source of Truth

### Description
The session management system saves the user role to the `sessions` table (`role: text("role")`) upon session creation. However, the request authentication utility (`resolveCurrentAuth`) ignores this value and queries the database on every request to fetch the user's role from the `users` table (`getUserRoleFromDb`).

### Why It Is Risky
While fetching the role dynamically from the `users` table prevents stale permissions, writing and maintaining a duplicate `role` column in the `sessions` table is redundant. This introduces unnecessary columns and write operations that are never read by the application.

### Evidence
- **File Paths:**
  - [schema.ts](file:///c:/bobsolar/src/lib/db/schema.ts#L113)
  - [session.ts](file:///c:/bobsolar/src/lib/auth/session.ts#L127-L137)
  - [validate.ts](file:///c:/bobsolar/src/lib/auth/validate.ts#L24-L38)

### SSoT Conflict
The user role is written to both `users.role` and `sessions.role`, but only `users.role` is treated as the true source of authority.

### Recommended Minimal Fix
Deprecate the `role` column in the `sessions` table and remove it from the `session` insert schema in the next database migration.

### Refactor Risk
Safe.

---

## Finding ID: FND-005
### Severity
Suspicious

### Category
Database Constraints

### Description
The `payment_methods` database table does not declare a `unique` constraint on its `name` column. The factory bootstrap script runs an insert with `.onConflictDoNothing()` but does not provide a conflict target.

### Why It Is Risky
Because PostgreSQL cannot detect a key conflict on the `name` column, running the bootstrap seed script multiple times will cause duplicate payment method names (e.g. multiple "Cash" or "KBZ Pay" records) to be inserted.

### Evidence
- **File Paths:**
  - [schema.ts](file:///c:/bobsolar/src/lib/db/schema.ts#L389-L394)
  - [factory-bootstrap.ts](file:///c:/bobsolar/src/lib/db/factory-bootstrap.ts#L45-L51)

### SSoT Conflict
The seeding script expects the database constraints to guard against duplicate name insertions, but the table schema does not enforce uniqueness.

### Recommended Minimal Fix
Add a `uniqueIndex` or a unique constraint on the `name` column of the `payment_methods` table in `schema.ts`:
```typescript
export const paymentMethods = pgTable("payment_methods", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").unique().notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

### Refactor Risk
Safe.

---

# Suspicious Usage

1. **Unused Domain Export (`ProjectExpenseType`):**
   - **Location:** [finance.ts](file:///c:/bobsolar/src/lib/domain/finance.ts#L87-L90)
   - **Context:** The domain model defines `PROJECT_EXPENSE_TYPES` and `ProjectExpenseType` but is completely unused. The codebase exclusively relies on `COST_TYPES` and `CostType` for expense records. This represents a duplicate, dead-weight type declaration.
2. **Manual Conversion of Decimals:**
   - **Location:** [ledger.ts](file:///c:/bobsolar/src/lib/finance/ledger.ts#L230-L231)
   - **Context:** Decimals from database selects are cast to numbers via `Math.round(Number(line.debit))`. This pattern is repeated across many actions. Centralizing the parsing logic inside a query wrapper or a custom Drizzle select mapping would minimize type friction.

---

# Architectural Drift Summary

The project is beginning to diverge from clean SSoT architectures in two ways:
1. **JSONB-First Modeling vs. Schema Columns:** The migration of standard product attributes (like Brand and Model) into the JSONB specifications column leads to inconsistencies where SQL indexing cannot be used for routine queries.
2. **Type Coercion at Boundaries:** There is a mismatch between database column storage types (Decimals) and boundary schemas (Integers). Forcing float data to conform to integer validators on the boundary leads to logic patches (e.g. using `Math.round()` on every calculation/insert path).

---

# Priority Fix Plan

## 1. Immediate Fixes (Pre-Release Blockers)
- **Fix the `manualJournalSchema` Zod refinement logic immediately** (FND-001). This is a critical vulnerability that permits unbalanced accounting entries.

## 2. Pre-Release Safeguards
- **Add a unique constraint to `payment_methods.name`** (FND-005) to prevent duplicate methods if the bootstrap script runs multiple times in production.

## 3. Safe Post-Release Improvements
- **Align Quantity validators with Decimal database capacities** (FND-003). Remove `.int()` validation from quotation item quantities so that clients can order fractional lengths of cables and mounting equipment.
- **Synchronize Brand/Model data locations** (FND-002). Ensure that when panels, inverters, and batteries are created, the `brand` and `model_number` columns are also populated alongside the JSONB specs.

## 4. Technical Debt Backlog
- **Clean up the `sessions.role` duplicate column** (FND-004) to reduce DB write amplification.
- **Remove `ProjectExpenseType`** (from `finance.ts`) to reduce domain declaration noise.
