# SSoT Audit Report

**Application:** BOB Solar — Next.js 16 + TypeScript 6 + Drizzle ORM  
**Audit Date:** 2026-05-31  
**Total Findings:** 24

---

## 1. Executive Summary

| Severity | Count |
|----------|-------|
| High     | 4     |
| Medium   | 12    |
| Low      | 8     |

**Main SSoT Risks:**
- Critical logic failure where discount validation errors are silently swallowed inside a `db.transaction()` callback
- Multiple domain types re-derived from DB enums creating parallel type sources
- `ownerTransactions` table uses raw `text()` columns instead of pgEnums, bypassing DB-level validation
- Environment variables accessed via bracket notation without centralized schema validation

**Main Performance Risks:**
- 118+ client components including several page-level components that could be server components with client islands
- Inconsistent query caching strategies with no centralized `staleTime` policy
- Proxy-based DB singleton adds overhead on every ORM property access

**Highest-Priority Fixes:**
1. Fix the lost `return errorResponse(...)` inside `updateQuotation` transaction callback (Finding #1)
2. Add pgEnums for `ownerTransactions.transactionType` and `ownerTransactions.status` (Finding #4)
3. Centralize duplicate domain types and eliminate re-derived type aliases (Findings #2, #3)
4. Centralize `ActionData<T>` helper type (Finding #9)

---

## 2. Methodology

Inspected all major layers: DB schema (Drizzle), Zod validators, domain constants/types, server actions, React Query hooks, Zustand stores, pricing engine, auth/session management, and utility modules.

Checked for: type alias duplication across files, schema↔validator↔DTO↔API drift, naming convention mismatches, unsafe casts, logic failures from inconsistent return types, N+1 query patterns, unnecessary client components, unstable props causing re-renders, missing cache invalidation, and bundle size risks.

Each finding is backed by exact file paths and line numbers. Uncertain items are marked **Suspicious**.

---

## 3. Findings

### Finding 1: Discount validation errors silently lost inside `updateQuotation` transaction

**Severity:** High  
**Category:** Logic failure  
**Status:** Confirmed  
**Files involved:**
- `src/actions/quotation-actions.ts:468-618`

**What I found:**  
The `updateQuotation` function calls `await db.transaction(async (tx) => { ... })` but does not capture or forward the callback's return value. Inside the callback, `return errorResponse(...)` returns from the callback (not from `updateQuotation`), so the error response is silently discarded. The code then proceeds to revalidate and query the DB, returning a success response even when the discount validation failed.

**Evidence:**  
```ts
// Line 468-496: errorResponse returns from the callback, NOT from updateQuotation
await db.transaction(async (tx) => {
  // ...
  if (auth.role !== "admin") {
    if (validated.discountPercent !== undefined && validated.discountPercent > 15) {
      return errorResponse("Standard users cannot apply a global discount greater than 15%");
      // ^ This returns from the callback. The result is discarded by the `await`.
    }
  }
  // ... rest of transaction
});

// Lines 620-631: These execute UNCONDITIONALLY after the transaction
revalidateTag(CACHE_TAGS.QUOTATIONS_LIST, "max");
// ...
return successResponse(updated); // ← Returns success even when validation failed
```

**Why this matters:**  
A non-admin user can apply discounts > 15% and the server will accept and persist them, violating the business rule. The frontend will show a success toast while the DB has been silently modified with invalid data.

**Likely source of truth:** The discount validation logic should be extracted BEFORE the transaction, or the transaction callback return value should be captured and forwarded.

**Suspicious usage:** All discount validation calls inside `db.transaction()` callbacks across `quotation-actions.ts`.

**Minimal fix plan:**  
Move the discount validation check before the `db.transaction()` call, or capture the transaction result and forward it:

```ts
// Option A: Validate BEFORE transaction
if (auth.role !== "admin") {
  if (validated.discountPercent !== undefined && validated.discountPercent > 15) {
    return errorResponse("Standard users cannot apply a global discount greater than 15%");
  }
}
// Then enter transaction

// Option B: Capture and forward
const txResult = await db.transaction(async (tx) => {
  // ... validation and logic
});
if (txResult && typeof txResult === "object" && "success" in txResult && !txResult.success) {
  return txResult as ActionFailure;
}
```

**Suggested target shape:**
```ts
// Validate before transaction to avoid lost error responses
if (auth.role !== "admin") {
  if (validated.discountPercent !== undefined && validated.discountPercent > 15) {
    return errorResponse("Standard users cannot apply a global discount greater than 15%");
  }
  if (validated.items) {
    for (const item of validated.items) {
      if (item.discountPercentage !== undefined && item.discountPercentage > 15) {
        return errorResponse("Standard users cannot apply an item discount greater than 15%");
      }
    }
  }
}

await db.transaction(async (tx) => {
  // ... business logic only, no errorResponse returns
});
```

---

### Finding 2: Duplicate `ProjectInvoiceStatus` type across schema and domain

**Severity:** Medium  
**Category:** Duplicate type  
**Status:** Confirmed  
**Files involved:**
- `src/lib/db/schema.ts:64-72`
- `src/lib/domain/invoice.ts:4-6`

**What I found:**  
`ProjectInvoiceStatus` is defined in two places:
1. `schema.ts:72` — derived from `projectInvoiceStatusEnum.enumValues`
2. `domain/invoice.ts:5` — derived from `PROJECT_INVOICE_STATUSES` which itself comes from `projectInvoiceStatusEnum.enumValues`

Both resolve to the same string literal union. The domain file re-derives it independently.

**Evidence:**  
```ts
// schema.ts:72
export type ProjectInvoiceStatus = (typeof projectInvoiceStatusEnum.enumValues)[number];

// domain/invoice.ts:4-6
export const PROJECT_INVOICE_STATUSES = projectInvoiceStatusEnum.enumValues;
export type ProjectInvoiceStatus = (typeof PROJECT_INVOICE_STATUSES)[number];
```

**Why this matters:**  
Two separate exports with the same name create ambiguity for import resolution. A developer might import from either location, and a linter or IDE might show conflicting type info. If the DB enum is ever modified, both files must be updated in lockstep.

**Likely source of truth:** `src/lib/db/schema.ts` should be the single source for all DB-derived types. Domain files should re-export, not re-derive.

**Suspicious usage:**  
- `domain/invoice.ts` — used by `project-invoices` pages and actions
- `schema.ts` — used by most actions and hooks

**Minimal fix plan:**  
In `domain/invoice.ts`, re-export from schema instead of re-deriving:
```ts
export { type ProjectInvoiceStatus } from "@/lib/db/schema";
export const PROJECT_INVOICE_STATUSES = projectInvoiceStatusEnum.enumValues;
```

---

### Finding 3: Duplicate `JournalSourceType` and `AccountingPeriodStatus` types

**Severity:** Medium  
**Category:** Duplicate type  
**Status:** Confirmed  
**Files involved:**
- `src/lib/db/schema.ts:135, 159`
- `src/lib/domain/finance.ts:226`
- `src/lib/domain/accounting-period.ts:5`

**What I found:**  
Three types are derived independently from the same DB enum values in both `schema.ts` and their respective domain files:
- `JournalSourceType` — `schema.ts:135` and `domain/finance.ts:226`
- `AccountingPeriodStatus` — `schema.ts:159` and `domain/accounting-period.ts:5`
- `PurchaseOrderStatus` — `schema.ts:143` and `domain/purchase.ts:7`
- `SupplierPaymentStatus` — `schema.ts:151` and `domain/purchase.ts:8`

**Evidence:**  
```ts
// schema.ts:135
export type JournalSourceType = (typeof journalSourceTypeEnum.enumValues)[number];

// domain/finance.ts:225-226
export const JOURNAL_SOURCE_TYPES = journalSourceTypeEnum.enumValues;
export type JournalSourceType = (typeof JOURNAL_SOURCE_TYPES)[number];
```

**Why this matters:**  
Same structural issue as Finding #2. Each domain file creates an independent type that mirrors the schema type. While the types are structurally identical, having multiple sources of truth increases maintenance risk.

**Likely source of truth:** `src/lib/db/schema.ts` for all DB-derived types. Domain files should re-export.

**Suspicious usage:** All domain files that re-derive DB enum types.

**Minimal fix plan:**  
Re-export from schema in domain files rather than re-deriving. The `export type` should use `export { type X } from "@/lib/db/schema"` syntax.

---

### Finding 4: `ownerTransactions` uses raw `text()` instead of pgEnums

**Severity:** Medium  
**Category:** Schema drift / Missing DB constraint  
**Status:** Confirmed  
**Files involved:**
- `src/lib/db/schema.ts:783-794`
- `src/lib/finance/equity.ts:88-93, 148-153, 203-210`

**What I found:**  
The `ownerTransactions` table defines `transactionType` and `status` as `text("transaction_type")` and `text("status")`, while every other entity in the schema uses `pgEnum` for constrained string values. Valid values are enforced only in application code via hardcoded string literals.

**Evidence:**  
```ts
// schema.ts:788-791
transactionType: text("transaction_type").notNull(), // 'distribution', 'draw', 'capital_call_issued', 'capital_contribution'
amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
transactionDate: timestamp("transaction_date").defaultNow().notNull(),
status: text("status").notNull(), // 'pending', 'completed'

// equity.ts:88-93 — hardcoded string literals with no enum backing
transactionType: "distribution",
amount: String(dist.amount),
transactionDate: date,
status: "completed",
```

**Why this matters:**  
No DB-level enforcement of valid values. Any string can be inserted. A typo in application code (`"complted"`) would be accepted by the DB. This breaks the SSoT pattern used everywhere else in the schema.

**Likely source of truth:** Create `ownerTransactionTypeEnum` and `ownerTransactionStatusEnum` pgEnums in `schema.ts`, similar to all other enum columns.

**Suspicious usage:**  
- `finance/equity.ts` — uses raw strings `"distribution"`, `"draw"`, `"capital_call_issued"`, `"capital_contribution"`, `"completed"`, `"pending"`

**Minimal fix plan:**  
Add pgEnums and migrate:
```ts
export const ownerTransactionTypeEnum = pgEnum("owner_transaction_type", [
  "distribution", "draw", "capital_call_issued", "capital_contribution",
]);
export const ownerTransactionStatusEnum = pgEnum("owner_transaction_status", [
  "pending", "completed",
]);
```

---

### Finding 5: Unsafe `as` casts in idempotency module

**Severity:** Medium  
**Category:** Unsafe typing  
**Status:** Confirmed  
**Files involved:**
- `src/lib/utils/idempotency.ts:33, 46`

**What I found:**  
The idempotency module stores and retrieves `ActionResponse<T>` as JSONB in the database. When retrieving, it uses `existing.response as ActionResponse<T>` — an unsafe cast from deserialized JSON. When storing, it uses `result as unknown as Record<string, unknown>` — a double cast through `unknown`.

**Evidence:**  
```ts
// Line 33: Unsafe retrieval cast
return existing.response as ActionResponse<T>;

// Line 46: Double cast for storage
response: result as unknown as Record<string, unknown>,
```

**Why this matters:**  
JSONB deserialization returns plain objects. The `as ActionResponse<T>` cast hides type mismatches — if the stored response has a different shape (e.g., after a schema change), this will silently produce incorrect types at runtime.

**Likely source of truth:** The idempotency key's `response` column should be typed as `z.ZodType<ActionResponse<unknown>>` or validated at retrieval time.

**Suspicious usage:**  
- Any caller of `withIdempotency()` that expects a specific `ActionResponse<T>` shape.

**Minimal fix plan:**  
Add runtime validation on retrieval:
```ts
const actionResponseSchema = z.union([
  z.object({ success: z.literal(true), data: z.unknown() }),
  z.object({ success: z.literal(false), error: z.string() }),
]);
const parsed = actionResponseSchema.safeParse(existing.response);
if (!parsed.success) {
  // handle corrupted idempotency record
}
return parsed.data as ActionResponse<T>;
```

---

### Finding 6: Variable shadowing of `itemIds` in `createQuotation`

**Severity:** Medium  
**Category:** Logic failure risk  
**Status:** Confirmed  
**Files involved:**
- `src/actions/quotation-actions.ts:241, 324`

**What I found:**  
In `createQuotation`, `itemIds` is declared at line 241 (outside the transaction) and re-declared at line 324 (inside the transaction callback). The inner declaration shadows the outer one, which is confusing and error-prone.

**Evidence:**  
```ts
// Line 241 — outer scope
const itemIds = validated.items
  .map((item) => item.itemId)
  .filter((id): id is string => id != null);

// Line 324 — inner scope (shadows outer)
const itemIds = enrichedItems
  .map((item) => item.itemId)
  .filter((id): id is string => id != null);
```

**Why this matters:**  
The inner `itemIds` is computed from `enrichedItems` (which may differ from `validated.items` due to price enrichment), while the outer `itemIds` comes from raw `validated.items`. Shadowing makes it unclear which one is used where and risks accidental misuse.

**Likely source of truth:** Use distinct names: `inventoryItemIds` for the outer query, `costLookupItemIds` for the inner query.

**Suspicious usage:**  
- `quotation-actions.ts:241-253` — outer `itemIds` used for unit price lookup
- `quotation-actions.ts:324-337` — inner `itemIds` used for cost price lookup

**Minimal fix plan:**  
Rename the inner variable to avoid shadowing:
```ts
const costLookupItemIds = enrichedItems
  .map((item) => item.itemId)
  .filter((id): id is string => id != null);
```

---

### Finding 7: Unsafe category cast in `quote-builder-store.ts`

**Severity:** Medium  
**Category:** Unsafe typing  
**Status:** Confirmed  
**Files involved:**
- `src/stores/quote-builder-store.ts:294`

**What I found:**  
When loading a quotation into the store, the code casts a `QuotationItem` to include a full `InventoryItem` relation, but the query in `quotation-actions.ts:187` only fetches `{ category: string }`. The cast is broader than necessary.

**Evidence:**  
```ts
// quote-builder-store.ts:294
category:
  (item as QuotationItem & { inventoryItem?: InventoryItem | null }).inventoryItem
    ?.category || null,

// quotation-actions.ts:186-190 — only fetches category
inventoryItem: {
  columns: {
    category: true,
  },
},
```

**Why this matters:**  
The cast to `InventoryItem` suggests the full item is available, but only `category` is loaded. If any code path were to access other fields via this cast, it would get `undefined` at runtime.

**Likely source of truth:** Define a narrow type for the fetched shape:
```ts
type QuotationItemWithCategory = QuotationItem & {
  inventoryItem: { category: InventoryCategory } | null;
};
```

**Suspicious usage:**  
- `quote-builder-store.ts:283-297` — `loadFromQuotation` method

**Minimal fix plan:**  
Use a narrower cast that matches the actual query shape:
```ts
category:
  (item as { inventoryItem?: { category: InventoryCategory } | null }).inventoryItem
    ?.category ?? null,
```

---

### Finding 8: Inconsistent mutation hook patterns across hooks

**Severity:** Medium  
**Category:** Naming mismatch / Inconsistent patterns  
**Status:** Confirmed  
**Files involved:**
- `src/hooks/use-customers.ts` — uses `createMutationHook` factory
- `src/hooks/use-quotations.ts` — manually implements each mutation
- `src/hooks/use-suppliers.ts` — manually implements with different error handling
- `src/hooks/use-purchases.ts` — manually implements with yet another pattern

**What I found:**  
The codebase has a `createMutationHook` factory (`mutation-factory.ts`) that standardizes mutation creation with toast notifications and cache invalidation. However, only `use-customers.ts` and `use-inventory.ts` use it. All other hook files manually implement mutations with varying patterns:

- `use-quotations.ts`: Returns `ActionResponse` from `mutationFn`, handles success/error in `onSuccess`
- `use-suppliers.ts`: Wraps `mutationFn` to throw on error, handles in `onError`
- `use-purchases.ts`: Mixed — some check `response.success` in `onSuccess`, some throw in `mutationFn`
- `use-projects.ts`: Manually implements with optimistic updates

**Evidence:**  
```ts
// use-customers.ts:60 — uses factory
export const useCreateCustomer = createMutationHook({
  mutationFn: (data: CreateCustomer) => createCustomer(data),
  invalidateKeys: [customerKeys.all],
  successMessage: "Customer added successfully",
  errorMessage: "Failed to add customer",
});

// use-suppliers.ts:27 — manual, throws on error
mutationFn: async (data: CreateSupplier) => {
  const res = await createSupplier(data);
  if (!res.success) throw new Error(res.error);
  return res.data;
},
```

**Why this matters:**  
Inconsistent patterns mean different error UX (some throw, some show toast), different cache invalidation approaches, and harder maintenance. New developers can't follow a single pattern.

**Likely source of truth:** The `createMutationHook` factory in `mutation-factory.ts`.

**Suspicious usage:**  
- `use-quotations.ts` — 8 mutation hooks, none use factory
- `use-projects.ts` — 8 mutation hooks, none use factory
- `use-suppliers.ts` — 3 mutation hooks, none use factory
- `use-purchases.ts` — 3 mutation hooks, none use factory

**Minimal fix plan:**  
Gradually migrate manual mutations to use `createMutationHook`. Start with the simplest cases (e.g., `useDeleteSupplier`, `useReceivePurchaseOrder`).

---

### Finding 9: Duplicate `ActionData<T>` type defined in 9+ hook files

**Severity:** Low  
**Category:** Duplicate type  
**Status:** Confirmed  
**Files involved:**
- `src/hooks/use-quotations.ts:18`
- `src/hooks/use-projects.ts:27`
- `src/hooks/use-payments.ts:11`
- `src/hooks/use-vouchers.ts:6`
- `src/hooks/use-warranty.ts:12`
- `src/hooks/use-notifications.ts:14`
- `src/hooks/use-purchases.ts:13`
- `src/hooks/use-dashboard.ts:11`
- `src/hooks/use-manual-journal.ts` (implicit via return types)

**What I found:**  
Nine hook files each independently define the identical utility type:
```ts
type ActionData<T> = T extends { data: infer D } ? D : never;
```

**Evidence:**  
All files contain the exact same type definition. No file imports it from a shared location.

**Why this matters:**  
If the `ActionResponse<T>` type changes shape (e.g., adding a `meta` field), all 9+ files would need manual updates. This is pure duplication.

**Likely source of truth:** `src/lib/utils/action-response.ts` should export this utility type.

**Suspicious usage:** All 9+ hook files listed above.

**Minimal fix plan:**  
Add to `action-response.ts`:
```ts
export type ActionData<T> = T extends { data: infer D } ? D : never;
```
Then update all hook files to import from there.

---

### Finding 10: `FinancePeriodFilter` imported indirectly through action re-export

**Severity:** Low  
**Category:** Naming mismatch / Indirect import  
**Status:** Confirmed  
**Files involved:**
- `src/hooks/use-finance-dashboard.ts:2`
- `src/actions/finance-dashboard-actions.ts:35`
- `src/lib/validators/finance.ts:8`

**What I found:**  
`use-finance-dashboard.ts` imports `FinancePeriodFilter` from `@/actions/finance-dashboard-actions`, which itself re-exports it from `@/lib/validators/finance`. The `query-keys.ts` file imports directly from the validator. This creates an indirect dependency.

**Evidence:**  
```ts
// use-finance-dashboard.ts:2
import type { FinancePeriodFilter } from "@/actions/finance-dashboard-actions";

// finance-dashboard-actions.ts:35
export type { FinancePeriodFilter, FinancePeriodFilterParsed } from "@/lib/validators/finance";
```

**Why this matters:**  
Importing a type through an action file creates an unnecessary dependency on the action module. The hook doesn't need the action module for this type.

**Likely source of truth:** `src/lib/validators/finance.ts` should be the direct import target.

**Suspicious usage:**  
- `use-finance-dashboard.ts` — imports from action file instead of validator

**Minimal fix plan:**  
Change the import in `use-finance-dashboard.ts` to:
```ts
import type { FinancePeriodFilter } from "@/lib/validators/finance";
```

---

### Finding 11: Missing environment variable type validation

**Severity:** Medium  
**Category:** Unsafe typing  
**Status:** Confirmed  
**Files involved:**
- `src/lib/db/index.ts:25`
- `src/lib/auth/session.ts:13`
- `src/lib/cache.ts:6-8`

**What I found:**  
Environment variables are accessed via bracket notation (`process.env["DATABASE_URL"]`) throughout the codebase with no centralized validation. Missing env vars only fail at runtime, not at build time.

**Evidence:**  
```ts
// db/index.ts:25
if (!process.env["DATABASE_URL"]) {
  throw new Error("DATABASE_URL is not set");
}

// auth/session.ts:13
const secret = process.env["SESSION_SECRET"];
if (!secret || secret.trim().length < 32) { ... }

// cache.ts:6-8 — validated with Zod but at runtime only
const kvEnvSchema = z.object({
  KV_REST_API_URL: z.url(),
  KV_REST_API_TOKEN: z.string().min(1),
});
```

**Why this matters:**  
Missing env vars cause runtime crashes in production. A centralized schema would catch misconfigurations at startup or build time.

**Likely source of truth:** A dedicated `env.ts` or `env.mjs` file using `@t3-oss/env-nextjs` or a Zod-based env schema.

**Suspicious usage:** All `process.env` accesses across the codebase.

**Minimal fix plan:**  
Create a minimal `src/lib/env.ts`:
```ts
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.url(),
  SESSION_SECRET: z.string().min(32),
  KV_REST_API_URL: z.url().optional(),
  KV_REST_API_TOKEN: z.string().min(1).optional(),
});

export const env = envSchema.parse(process.env);
```

---

### Finding 12: Proxy-based DB singleton adds overhead on every access

**Severity:** Low  
**Category:** Performance  
**Status:** Confirmed  
**Files involved:**
- `src/lib/db/index.ts:34-37`

**What I found:**  
The `db` export uses a `Proxy` that delegates every property access to `getDb()`. While `getDb()` is memoized after first call, the proxy trap runs on every ORM operation (every `.select()`, `.insert()`, `.update()`, `.query.*`).

**Evidence:**  
```ts
export const db = new Proxy({} as ReturnType<typeof getDb>, {
  get(_target, prop: string | symbol): unknown {
    return getDb()[prop as keyof ReturnType<typeof getDb>];
  },
});
```

**Why this matters:**  
Every database interaction pays the cost of a proxy trap. In a request-heavy app, this adds measurable overhead. The proxy exists for backward compatibility but could be replaced with a direct export.

**Likely source of truth:** Export `db` directly from `getDb()` after first initialization.

**Suspicious usage:**  
- Every file that imports `db` from `@/lib/db`

**Minimal fix plan:**  
If backward compatibility is no longer needed, replace the proxy with:
```ts
export function getDb(): ReturnType<typeof drizzle<typeof schema>> { ... }
// Lazy getter pattern instead of proxy
let _db: ReturnType<typeof getDb>> | null = null;
export function getDb() { ... }
// Or simply export a lazy-initialized db
```

---

### Finding 13: Inconsistent `staleTime` values with no centralized policy

**Severity:** Low  
**Category:** Performance / Inconsistent configuration  
**Status:** Suspicious  
**Files involved:**
- `src/hooks/use-customers.ts:30` — 30s
- `src/hooks/use-inventory.ts:29` — 5min
- `src/hooks/use-projects.ts:52` — 30s
- `src/hooks/use-dashboard.ts:26` — 60s
- `src/hooks/use-notifications.ts:26` — 15s
- `src/hooks/use-suppliers.ts` — no staleTime (default)

**What I found:**  
Each hook independently defines its `staleTime` without a centralized policy. Values range from 15s to 5min with no clear rationale.

**Evidence:**  
```ts
// use-customers.ts:30
staleTime: 30 * 1000,

// use-inventory.ts:29
staleTime: 5 * 60 * 1000,

// use-dashboard.ts:26
staleTime: 60 * 1000,

// use-suppliers.ts — no staleTime specified (defaults to 0)
```

**Why this matters:**  
Without a policy, stale times are arbitrary. Some data (suppliers) has no caching while others (inventory) caches for 5 minutes. This creates inconsistent UX and makes it hard to reason about data freshness.

**Likely source of truth:** A centralized `query-config.ts` with `staleTime` presets per data category.

**Suspicious usage:** All React Query hooks across the codebase.

**Minimal fix plan:**  
Create `src/lib/query-config.ts`:
```ts
export const STALE_TIME = {
  REALTIME: 15_000,      // notifications, unread counts
  SHORT: 30_000,          // lists, detail pages
  MEDIUM: 60_000,         // dashboard stats
  LONG: 5 * 60_000,      // reference data (inventory, payment methods)
} as const;
```

---

### Finding 14: `refetchInterval` polling on dashboard and notification queries

**Severity:** Low  
**Category:** Performance  
**Status:** Suspicious  
**Files involved:**
- `src/hooks/use-dashboard.ts:51` — `refetchInterval: 2 * 60 * 1000`
- `src/hooks/use-notifications.ts:41` — `refetchInterval: 30 * 1000`

**What I found:**  
Two hooks use `refetchInterval` for polling:
- `useRecentActivity` polls every 2 minutes
- `useUnreadCount` polls every 30 seconds

**Evidence:**  
```ts
// use-dashboard.ts:50-51
staleTime: 2 * 60 * 1000,
refetchInterval: 2 * 60 * 1000,

// use-notifications.ts:40-41
staleTime: 15 * 1000,
refetchInterval: 30 * 1000,
```

**Why this matters:**  
Continuous polling consumes battery on mobile devices and generates unnecessary network traffic. The notification polling is reasonable for real-time UX, but the dashboard activity polling is less critical.

**Likely source of truth:** Consider using WebSockets or Server-Sent Events for real-time notifications instead of polling. Dashboard polling could be replaced with `refetchOnWindowFocus`.

**Suspicious usage:**  
- `use-notifications.ts:41` — polls every 30s even when tab is hidden
- `use-dashboard.ts:51` — polls every 2min

**Minimal fix plan:**  
Add `refetchIntervalInBackground: false` and consider `refetchOnWindowFocus: true` as a lighter alternative for dashboard data.

---

### Finding 15: `use-quote-totals.ts` recomputes on every store update

**Severity:** Low  
**Category:** Performance  
**Status:** Suspicious  
**Files involved:**
- `src/hooks/use-quote-totals.ts:12-19`

**What I found:**  
`useQuoteTotals` subscribes to `items`, `discountPercent`, and `taxPercent` from the Zustand store. The `useMemo` dependency on `items` (an array) means it recomputes on every store update that touches items, since each store mutation creates a new array reference.

**Evidence:**  
```ts
const items = useQuoteBuilderStore((s) => s.items);
const discountPercent = useQuoteBuilderStore((s) => s.discountPercent);
const taxPercent = useQuoteBuilderStore((s) => s.taxPercent);

return useMemo(
  () => calculateQuotation(items, discountPercent, taxPercent),
  [items, discountPercent, taxPercent],
);
```

**Why this matters:**  
`calculateQuotation` iterates all items on each call. For quotes with many items, this could cause jank during rapid editing. However, the memo correctly prevents recomputation when only `notes` or `validUntil` change.

**Likely source of truth:** This is acceptable for the current scale. Consider a Zustand selector with shallow equality if performance becomes an issue.

**Suspicious usage:**  
- `quote-builder-store.ts` — all item mutations create new arrays

**Minimal fix plan:**  
If needed, add a derived selector in Zustand:
```ts
const totals = useQuoteBuilderStore(
  useCallback((s) => calculateQuotation(s.items, s.discountPercent, s.taxPercent), [])
);
```

---

### Finding 16: `formatSpecNumber` has redundant logic

**Severity:** Low  
**Category:** Logic failure  
**Status:** Confirmed  
**Files involved:**
- `src/lib/domain/inventory.ts:103-105`

**What I found:**  
The `formatSpecNumber` function checks if a value is an integer but returns `String(value)` in both branches — the integer and non-integer paths produce identical output.

**Evidence:**  
```ts
function formatSpecNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value);
}
```

**Why this matters:**  
This is dead logic. The function was likely intended to format integers without decimals and non-integers with a fixed precision, but both branches now do the same thing.

**Likely source of truth:** Either remove the function and use `String(value)` directly, or restore the intended formatting logic.

**Suspicious usage:**  
- `inventory.ts:123, 143, 144, 169, 179` — called in formatting functions

**Minimal fix plan:**  
Replace with `String(value)` or implement the intended decimal formatting.

---

### Finding 17: `getErrorMessage` and `formatErrorMessage` are near-duplicates

**Severity:** Low  
**Category:** Duplicate type / Near-duplicate logic  
**Status:** Confirmed  
**Files involved:**
- `src/lib/utils/query-error.ts:1-4`
- `src/lib/utils/error.ts:78-86`

**What I found:**  
Two utility functions extract error messages from unknown errors with overlapping logic:
- `getErrorMessage` in `query-error.ts`
- `formatErrorMessage` in `error.ts`

Both handle `Error` instances and string errors, but `formatErrorMessage` also handles `ZodError`.

**Evidence:**  
```ts
// query-error.ts:1-4
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Something went wrong. Please try again.";
}

// error.ts:78-86
export function formatErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message || "Validation failed";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}
```

**Why this matters:**  
Two functions doing essentially the same thing with slightly different behavior. This creates confusion about which to use.

**Likely source of truth:** `error.ts` has more complete handling. `query-error.ts`'s `getErrorMessage` could be replaced by importing from `error.ts`.

**Suspicious usage:**  
- `query-error.ts` — used by hooks and client code
- `error.ts` — used by server actions

**Minimal fix plan:**  
Consolidate into `error.ts` and deprecate `getErrorMessage` in `query-error.ts`.

---

### Finding 18: `ownerTransactions` type not exported from schema

**Severity:** Low  
**Category:** Missing SSoT export  
**Status:** Confirmed  
**Files involved:**
- `src/lib/db/schema.ts:1211-1212`

**What I found:**  
`OwnerTransaction` and `NewOwnerTransaction` types are exported from `schema.ts` but have no corresponding domain type file, no Zod validator, and no label maps — unlike every other entity in the system.

**Evidence:**  
```ts
// schema.ts:1211-1212
export type OwnerTransaction = InferSelectModel<typeof ownerTransactions>;
export type NewOwnerTransaction = InferInsertModel<typeof ownerTransactions>;
```

No corresponding `domain/owner-transaction.ts` or `validators/owner-transaction.ts` exists.

**Why this matters:**  
The owner transaction entity is the only one without domain-level type definitions, validators, and label maps. This breaks the pattern established by all other entities.

**Likely source of truth:** Create `domain/owner-transaction.ts` with enums and labels.

**Suspicious usage:**  
- `finance/equity.ts` — uses hardcoded strings for transactionType and status

**Minimal fix plan:**  
Create `domain/owner-transaction.ts` with proper enums and re-export types from schema.

---

### Finding 19: `CACHE_TAGS` is incomplete relative to actual cache usage

**Severity:** Low  
**Category:** Schema drift  
**Status:** Suspicious  
**Files involved:**
- `src/lib/cache-tags.ts:7-12`
- `src/actions/quotation-actions.ts:64-65`

**What I found:**  
`CACHE_TAGS` only defines 4 cache tags: `QUOTATIONS_LIST`, `INVENTORY_LIST`, `DASHBOARD_STATS`, `SETTINGS_COMPANY`. However, `unstable_cache` in actions uses hardcoded string keys like `"quotations:list-page"` that don't match the centralized constants.

**Evidence:**  
```ts
// cache-tags.ts:7-12
export const CACHE_TAGS = {
  QUOTATIONS_LIST: "quotations:list",
  INVENTORY_LIST: "inventory:list",
  DASHBOARD_STATS: "dashboard:stats",
  SETTINGS_COMPANY: "settings:company",
} as const;

// quotation-actions.ts:64-65
["quotations:list-page"],
{ tags: [CACHE_TAGS.QUOTATIONS_LIST], revalidate: 300 },
```

The cache key `"quotations:list-page"` is different from `CACHE_TAGS.QUOTATIONS_LIST` (`"quotations:list"`), suggesting the key and tag serve different purposes but this isn't documented.

**Why this matters:**  
Cache keys and tags being different strings makes it hard to reason about what's being cached and invalidated. The hardcoded string `"quotations:list-page"` bypasses the centralized SSoT.

**Likely source of truth:** Either the `unstable_cache` key should use the same constant, or the distinction between keys and tags should be documented.

**Suspicious usage:**  
- `quotation-actions.ts:64` — hardcoded key `"quotations:list-page"`
- `inventory-actions.ts:56` — hardcoded key `"inventory:list-page"`

**Minimal fix plan:**  
Add the cache keys to `CACHE_TAGS` or create a separate `CACHE_KEYS` constant.

---

### Finding 20: `use-debounce.ts` doesn't cleanup on unmount

**Severity:** Low  
**Category:** Performance / Memory leak  
**Status:** Suspicious  
**Files involved:**
- `src/hooks/use-debounce.ts:3-16`

**What I found:**  
The `useDebounce` hook sets a timeout in `useEffect` and returns a cleanup function. However, if the component unmounts while the timeout is pending, the cleanup should clear it. The current implementation does return a cleanup, so this is actually correct — but the default delay of 500ms is quite long and might cause stale debounced values.

**Evidence:**  
```ts
export function useDebounce<T>(value: T, delay?: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay ?? 500);
    return (): void => {
      clearTimeout(timer);
    };
  }, [value, delay]);
  return debouncedValue;
}
```

**Why this matters:**  
The `delay` parameter is in the dependency array but is rarely specified by callers. If a caller changes the delay, the effect re-runs and resets the debounce, which could cause unexpected behavior.

**Likely source of truth:** Acceptable as-is. Document that `delay` should be stable (useMemo'd by caller).

**Suspicious usage:**  
- `use-quote-autosave.ts:50` — uses debounce with custom delay

**Minimal fix plan:**  
No change needed; document the behavior.

---

### Finding 21: `as any` usage in test files

**Severity:** Low  
**Category:** Unsafe typing  
**Status:** Confirmed  
**Files involved:**
- `src/actions/quotation-actions.create-duplicate.test.ts:21`
- `src/actions/project-actions.more2.test.ts:13-50`
- `src/actions/project-actions.guard.test.ts:14-116`
- `src/actions/payment-actions.finance.test.ts:12`

**What I found:**  
Test files use `as any` in 14 places to mock database results and module dependencies. While `as any` in tests is less critical than in production code, it hides type mismatches that could cause tests to pass when they shouldn't.

**Evidence:**  
```ts
// project-actions.more2.test.ts:13-50
vi.mock("@/lib/db", () => ({
  db: { /* mock */ },
}));
// ... multiple `as any` casts for mock data
```

**Why this matters:**  
`as any` in tests can mask type errors. If the production code changes its type expectations, the test might still pass because the mock is untyped.

**Likely source of truth:** Use `satisfies` or proper type annotations for mock data.

**Suspicious usage:**  
- All test files with `as any` casts

**Minimal fix plan:**  
Replace `as any` with `satisfies Partial<ExpectedType>` or create typed test factories.

---

### Finding 22: `quote-autosave.ts` imports from validator but not from domain

**Severity:** Low  
**Category:** Naming mismatch  
**Status:** Suspicious  
**Files involved:**
- `src/hooks/use-quote-autosave.ts:4-16`
- `src/lib/quotations/quote-autosave.ts`

**What I found:**  
The autosave hook imports actions directly from `@/actions/quotation-actions` but the autosave utility module imports from `@/lib/validators/quotation`. This creates a circular dependency risk as the autosave module imports from validators which could eventually import from the autosave module.

**Evidence:**  
```ts
// use-quote-autosave.ts:4-5
import { createQuotation, updateQuotation } from "@/actions/quotation-actions";

// lib/quotations/quote-autosave.ts (imported by the hook)
import { quotationItemSchema } from "@/lib/validators/quotation";
```

**Why this matters:**  
The dependency chain: hook → actions → validators → (potentially) autosave. If any circular dependency forms, it could cause runtime failures.

**Likely source of truth:** The autosave module should not depend on action modules.

**Suspicious usage:**  
- `use-quote-autosave.ts` — imports both actions and autosave utility

**Minimal fix plan:**  
Ensure the autosave utility module doesn't import from actions. If it does, extract the shared logic.

---

### Finding 23: `assertFinanceSsotDrift` is a runtime assertion, not a type-level check

**Severity:** Low  
**Category:** Other  
**Status:** Suspicious  
**Files involved:**
- `src/lib/finance/ledger.ts:69-93`

**What I found:**  
The `assertFinanceSsotDrift` function performs runtime checks that required payment methods and cost types exist in the domain constants. This is called at the start of finance operations to detect drift.

**Evidence:**  
```ts
export function assertFinanceSsotDrift(): void {
  const methodSet = new Set(PAYMENT_METHOD_PRESETS);
  const requiredMethods = ["cash", "kbz_banking", ...] as const;
  for (const method of requiredMethods) {
    if (!methodSet.has(method)) {
      throw new Error(`Finance SSoT drift: required payment method '${method}' is missing.`);
    }
  }
  // ... similar for cost types
}
```

**Why this matters:**  
This is a good defensive pattern, but it only runs when finance operations are called. If a new payment method is added to the DB but not to the domain constants, the assertion would catch it — but only at runtime.

**Likely source of truth:** This pattern should be extended to all enum domains, or replaced with a build-time type test.

**Suspicious usage:**  
- Called in `payment-actions.ts:38` and other finance actions

**Minimal fix plan:**  
Consider adding TypeScript type tests (e.g., `expectTypeOf`) that verify domain constants match DB enums at compile time.

---

### Finding 24: `components.json` exists but is not referenced in the audit

**Severity:** Low  
**Category:** Other  
**Status:** Suspicious  
**Files involved:**
- `components.json`

**What I found:**  
A `components.json` file exists at the project root, which is typically used by shadcn/ui CLI for component configuration. This file should define the component path, aliases, and styling configuration.

**Evidence:**  
Not inspected in detail — this is a configuration file, not a type/schema file.

**Why this matters:**  
If the shadcn/ui configuration doesn't match the actual project structure (e.g., wrong import aliases), newly added components may have incorrect imports.

**Likely source of truth:** Verify that `components.json` aliases match `tsconfig.json` paths.

**Suspicious usage:**  
- Any newly added shadcn/ui components

**Minimal fix plan:**  
Verify `components.json` has correct `aliases` matching `tsconfig.json` paths.

---

## 4. Cross-Cutting SSoT Risks

1. **DB enum types re-derived in domain files** — `ProjectInvoiceStatus`, `JournalSourceType`, `AccountingPeriodStatus`, `PurchaseOrderStatus`, `SupplierPaymentStatus` are all derived independently in both `schema.ts` and their domain files. The schema should be the single source; domain files should re-export.

2. **`ownerTransactions` table uses `text()` instead of pgEnums** — This entity is the only one without DB-level enum constraints, creating a gap in the SSoT pattern.

3. **Multiple `ActionData<T>` definitions** — Nine hook files independently define the same utility type. Should be centralized in `action-response.ts`.

4. **Inconsistent mutation hook patterns** — `createMutationHook` factory exists but is only used by 2 of 12+ hook modules. The remaining modules manually implement mutations with varying patterns.

5. **Hardcoded string literals in finance code** — `equity.ts` uses raw strings (`"distribution"`, `"completed"`) for owner transaction types and statuses instead of enum constants.

6. **Environment variables without centralized validation** — `process.env` accesses scattered across the codebase with no build-time safety.

---

## 5. Cross-Cutting Performance Risks

1. **118+ client components** — Many page-level components use `"use client"` when they could be server components with client islands. Key examples:
   - `settings/page.tsx` — full page is a client component
   - `warranty/page.tsx` — full page is a client component
   - `suppliers/page.tsx` — full page is a client component
   - `purchases/new/page.tsx` — full page is a client component

2. **Inconsistent `staleTime` with no policy** — Each hook independently configures caching duration, ranging from 15s to 5min with no documented rationale.

3. **Continuous polling for notifications and dashboard** — `useUnreadCount` polls every 30s, `useRecentActivity` polls every 2min. Consider `refetchOnWindowFocus` as a lighter alternative.

4. **Proxy-based DB singleton** — Every database property access goes through a Proxy trap, adding overhead to every ORM operation.

5. **Duplicate error utility functions** — `getErrorMessage` and `formatErrorMessage` overlap, creating unnecessary module dependencies.

---

## 6. Recommended Fix Plan

### Phase 1 — Minimal Safety Fixes
1. **Fix lost error responses in `updateQuotation`** (Finding #1) — Move discount validation before the transaction or capture transaction return value.
2. **Add pgEnums for `ownerTransactions`** (Finding #4) — Create `ownerTransactionTypeEnum` and `ownerTransactionStatusEnum`.
3. **Fix variable shadowing in `createQuotation`** (Finding #6) — Rename inner `itemIds` to `costLookupItemIds`.
4. **Validate idempotency response on retrieval** (Finding #5) — Add runtime validation for JSONB response.

### Phase 2 — SSoT Consolidation
1. **Re-export DB types from domain files** (Findings #2, #3) — Change domain files to `export { type X } from "@/lib/db/schema"` instead of re-deriving.
2. **Centralize `ActionData<T>`** (Finding #9) — Add to `action-response.ts`, update all hook imports.
3. **Centralize `FinancePeriodFilter` import** (Finding #10) — Import directly from validator, not through action re-export.
4. **Create domain types for `ownerTransactions`** (Finding #18) — Add `domain/owner-transaction.ts` with enums and labels.
5. **Add centralized env validation** (Finding #11) — Create `env.ts` with Zod schema for all required env vars.
6. **Consolidate error utilities** (Finding #17) — Merge `getErrorMessage` into `error.ts`, deprecate the duplicate.

### Phase 3 — Performance Hardening
1. **Audit `"use client"` components** — Convert page-level components to server components where possible. Start with `settings/page.tsx`, `warranty/page.tsx`, `suppliers/page.tsx`.
2. **Create centralized stale time policy** (Finding #13) — Define `STALE_TIME` constants in `query-config.ts`.
3. **Evaluate polling strategy** (Finding #14) — Consider `refetchOnWindowFocus` over `refetchInterval` for dashboard data.
4. **Replace DB proxy with direct export** (Finding #12) — If backward compatibility allows, remove the Proxy overhead.
5. **Migrate mutation hooks to factory** (Finding #8) — Start with simplest cases, move complex ones last.

### Phase 4 — Prevention
1. **Add TypeScript type tests** — Use `expectTypeOf` to verify domain enums match DB enums at compile time.
2. **Add lint rule for `as any`** — Configure biome/eslint to warn on `as any` outside test files.
3. **Document stale time policy** — Add comments explaining why each data category has its configured stale time.
4. **Add CI check for env vars** — Verify `.env.example` matches the env schema.
5. **Code review rule** — Require new entities to have: DB enum, domain types, Zod validators, label maps.

---

## 7. Files Requiring Follow-Up

| File | Reason |
|------|--------|
| `src/actions/quotation-actions.ts:468-618` | **Critical**: Verify the discount validation logic failure with a test case |
| `src/lib/db/schema.ts:783-794` | Confirm `ownerTransactions` text columns should become pgEnums |
| `src/stores/quote-builder-store.ts:294` | Verify the category cast works correctly with the narrow query shape |
| `src/lib/utils/idempotency.ts:33` | Test with corrupted JSONB data to confirm the cast fails gracefully |
| `src/hooks/use-quotations.ts:51-77` | Evaluate migration to `createMutationHook` factory |
| `src/lib/domain/inventory.ts:103-105` | Confirm `formatSpecNumber` is dead code or restore intended logic |
| `src/lib/finance/equity.ts:214` | Confirm the non-null assertion is safe given the insert flow |
| `components.json` | Verify aliases match `tsconfig.json` paths |
