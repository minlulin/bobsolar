# Executive Summary
The BOB Solar Next.js + TypeScript application shows overall good architectural health, using modern practices like Drizzle ORM, Zod validation, and strict typing. However, there are significant areas of Single Source of Truth (SSoT) drift between the database layer, domain models, API contracts, and form state. The most critical risks involve duplicate enum definitions across domains and schema files, data type drift for financial decimals (resulting in brittle manual coercions), UI validation diverging from API validation, and potential precision loss bugs across client/server boundaries.

# Audit Rules Applied
- TypeScript strictest-mode expectations (exact match between interfaces and implementations, no unsafe type assertions).
- Biome strict lint expectations (clean imports, explicit typings, avoiding duplicated declarations).
- Naming consistency expectations (consistent naming for matching entities across boundaries).
- SSoT validation principles (data shapes and constant values must derive from a single unified source—either the DB schema or a centralized domain model).

# Findings

## F-001
### Severity
High

### Category
Type Drift & Duplicate Source of Truth

### Description
There is systematic duplication of Enum type definitions between the database schema (`src/lib/db/schema.ts`) and the domain layer (`src/lib/domain/*.ts`). The DB schema defines `pgEnum` and extracts types using `typeof enum.enumValues[number]`. The domain layer then explicitly redeclares these exact same types. For example, `InventoryCategory` and `InventoryUnit` are exported from both `schema.ts` and `domain/inventory.ts`. `QuotationStatus` is similarly duplicated in `schema.ts` and `domain/quotation.ts`. `LedgerAccountType` and `JournalSourceType` are manually maintained arrays in `domain/finance.ts` but are also declared as `pgEnum`s in `schema.ts`.

### Why It Is Risky
Adding or renaming a value in a database enum requires updating multiple disjointed files. If a developer updates the DB schema but misses the domain file (or vice versa), it creates a split brain. Components importing from `schema.ts` will expect one set of values, while validators and UI components importing from `domain/*.ts` will expect another, leading to subtle runtime validation failures and TypeScript errors.

### Evidence
- `src/lib/db/schema.ts`: `export type InventoryCategory = (typeof inventoryCategoryEnum.enumValues)[number];`
- `src/lib/domain/inventory.ts`: `export type InventoryCategory = (typeof inventoryCategoryEnum.enumValues)[number];`
- `src/lib/db/schema.ts`: `export const ledgerAccountTypeEnum = pgEnum("ledger_account_type", ["asset", "liability", "equity", "income", "expense"]);`
- `src/lib/domain/finance.ts`: `export const LEDGER_ACCOUNT_TYPES = ["asset", "liability", "equity", "income", "expense"] as const;`

### SSoT Conflict
`schema.ts` and `domain/*.ts` are competing sources of truth for the exact same TypeScript enum definitions.

### Recommended Minimal Fix
Remove the duplicated `export type` declarations in the DB schema file (or remove them from the domain file and re-export the schema types). For `domain/finance.ts`, use the `enumValues` property of the `pgEnum` from `schema.ts` instead of manually redefining the array constants.

## F-002
### Severity
High

### Category
Data Type Inconsistency & Serialization Risk

### Description
There is a fundamental impedance mismatch between how financial amounts are stored and validated. PostgreSQL uses `decimal` fields (e.g., `amount`, `subtotal`, `total`, `discountPercent`), which Drizzle ORM correctly types as `string` in TypeScript to prevent floating-point precision loss. However, the application boundary (Zod validators, React forms, Zustand stores) explicitly expects and uses `number`. The codebase bridges this gap with ad-hoc manual conversions (`Number(val)` and `val.toString()`) scattered heavily throughout Server Actions (e.g., `quotation-actions.ts`, `project-actions.ts`).

### Why It Is Risky
Manual conversion is highly error-prone. Missing a `toString()` call before insertion, or a `Number()` call before calculation, will cause TypeScript errors at best, or silent `NaN` DB insertions / incorrect calculations at worst. Relying on floating point `number`s for UI validation while DB expects arbitrary precision `string`s means large values might lose precision during the roundtrip.

### Evidence
- `src/lib/db/schema.ts`: `totalAmount: decimal("total_amount", { precision: 15, scale: 2 }).notNull()` (Inferred as `string`)
- `src/lib/validators/voucher.ts`: `totalAmount: z.number().int().min(0)`
- `src/stores/quote-builder-store.ts`: `unitPrice: Number(inventoryItem.unitPrice)`
- `src/actions/quotation-actions.ts`: `patch.subtotal = pricing.subtotal.toString();`
- `src/actions/project-actions.ts`: `patch.systemSizeKwp = String(data.systemSizeKwp);`

### SSoT Conflict
The type definition for financial amounts is `string` in the persistence layer, but `number` in the validation/UI layer, without a robust mapping layer.

### Recommended Minimal Fix
Implement a centralized DTO mapping layer or utilize Zod transformations (e.g., `z.string().transform(Number)` for API output, and `z.number().transform(String)` for DB input) to safely and consistently handle `string` <-> `number` coercions. Stop relying on manual `Number()` and `String()` casts scattered across Server Actions.

## F-003
### Severity
Medium

### Category
Form Desynchronization

### Description
The `QuoteBuilderItem` in `src/stores/quote-builder-store.ts` enforces validation logic that the Zod schema (`quotationItemSchema` in `src/lib/validators/quotation.ts`) does not know about. Specifically, the Zustand store forces `quantity` to be sanitized to 2 decimal places with a minimum of 0.01: `Math.max(0.01, Math.round(partial.quantity * 100) / 100)`. The corresponding Zod schema only enforces `z.number().positive()`.

### Why It Is Risky
Validation logic is split. The client-side store enforces stricter rules than the server-side validator. A user bypassing the UI (or an edge case in the UI) could submit a payload with a quantity of `0.0001` or `1.123456`, which the server would accept, potentially causing unexpected rounding behavior in the pricing engine or DB.

### Evidence
- `src/stores/quote-builder-store.ts`: `quantity: Math.max(0.01, Math.round(partial.quantity * 100) / 100)`
- `src/lib/validators/quotation.ts`: `quantity: z.number().positive("Quantity must be positive")`

### SSoT Conflict
The UI store acts as the source of truth for rounding/minimum rules, while the server validator is overly permissive.

### Recommended Minimal Fix
Move the decimal rounding and minimum value validation logic into the Zod schema using `.min(0.01)` and a custom `.transform(val => Math.round(val * 100) / 100)` (or `.superRefine`), ensuring the server enforces the exact same rules as the UI.

## F-004
### Severity
Suspicious

### Category
Unsafe Typing / Inconsistent Nullability

### Description
The project frequently uses `.optional().nullable()` in Zod schemas (e.g., `createProjectSchema`, `createCustomerSchema`). This allows `undefined` and `null` to be used interchangeably.

### Why It Is Risky
It creates ambiguity at the DB boundary. In a `PATCH` request, `undefined` typically means "do not update this field", while `null` means "clear this field". By merging them, action files must explicitly check `!== undefined` to safely patch. If a client sends `{ siteAddress: null }`, Drizzle might clear the address, whereas if it sends `{}`, Drizzle skips it. Allowing both indiscriminately weakens the API contract.

### Evidence
- `src/lib/validators/customer.ts`: `email: z.email("...").optional().nullable().or(z.literal(""))`
- `src/lib/validators/project.ts`: `siteAddress: z.string().max(500).optional().nullable()`

### SSoT Conflict
Lack of a strict standard for "absence of value" between the API boundary and the DB layer.

### Recommended Minimal Fix
Audit Zod schemas. Use `.optional()` for fields that can be omitted from the payload (defaulting to undefined). Use `.nullable()` specifically for fields where explicitly setting a `null` value is valid and required by the DB.

## F-005
### Severity
Low

### Category
Naming Inconsistency

### Description
Inconsistent naming between DB schema and validation types. For example, `discountPercent` in the DB vs `discountPercentage` in the UI and Zod schemas.

### Why It Is Risky
It requires manual object mapping in action files, increasing the surface area for mapping bugs (e.g., `patch.discountPercent = validated.discountPercentage.toString()` - though currently it is `validated.discountPercent`, the `quotationItemSchema` uses `discountPercentage`).

### Evidence
- `src/lib/db/schema.ts`: `discountPercent: decimal(...)` for quotation, but `discountPercentage: decimal(...)` for quotationItems.
- `src/lib/validators/quotation.ts`: `discountPercentage` for item, `discountPercent` for quote.

### SSoT Conflict
Domain language drift across entities.

### Recommended Minimal Fix
Standardize the naming convention for percentages (either `Percent` or `Percentage`) across the DB schema and validators.

# Suspicious Usage
- `Number(item.quantity)` and `String(value)` calls scattered throughout Server Actions instead of a unified mapping layer. Highly susceptible to developer error.
- Use of `Math.round()` in scattered action files (e.g., `src/actions/project-actions.ts` during inventory consumption) instead of centralized pricing engine functions. This risks rounding discrepancies between reports, ledgers, and UI views.

# Architectural Drift Summary
The application has started diverging from a strict Single Source of Truth architecture. Initially, schemas and domain models likely aligned, but over time UI requirements (e.g., needing numbers instead of strings for inputs) caused the Zod validation schemas and Zustand stores to diverge from the Drizzle DB schema. This has resulted in a heavy reliance on manual data mapping and type casting in the Server Actions. Furthermore, domain enums are duplicated across the schema and domain files, breaking the SSoT principle and risking silent divergence.

# Priority Fix Plan
1. Immediate fixes: Resolve enum duplication by making `src/lib/db/schema.ts` the true single source of truth for all literal enum values, importing them into the domain files instead of recreating them.
2. Pre-release blockers: Address the `decimal`/`string`/`number` data type drift. Consolidate rounding and string coercion logic into centralized Zod transformers or a DTO layer to remove manual `Number()` and `String()` casts from Server Actions. Ensure all financial calculations pass through `src/lib/pricing/engine.ts`.
3. Safe post-release improvements: Synchronize UI store logic (Zustand) with Zod validators (e.g., minimum quantities, rounding rules) to ensure the server validates exactly what the UI enforces.
4. Technical debt backlog recommendations: Standardize `.optional()` vs `.nullable()` usage in API contracts to explicitly differentiate between omitted fields and cleared values.
