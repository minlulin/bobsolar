# BOB Solar: Sprint 3 Implementation Plan

This document details the exact technical steps needed to complete **Sprint 3 (Performance + Polish)**. It is structured to be highly actionable for an AI coding assistant.

---

## Part 1: Performance Optimizations

### 1. Add Pagination to `getQuotations` (P2-2)

- **Objective:** Prevent the quotations list from slowing down as the database grows by implementing offset-based or cursor-based pagination.
- **Target Files:** `src/actions/quotation-actions.ts`, `src/app/(dashboard)/quotations/page.tsx`
- **Implementation Steps:**
  1. Update `QuotationFilter` schema in `src/lib/validators/quotation.ts` to include `page` (number, default: 1) and `limit` (number, default: 20).
  2. In `getQuotations()`, calculate `offset = (page - 1) * limit`.
  3. Update the `db.query.quotations.findMany()` call to include `limit` and `offset`.
  4. Run a secondary `db.select({ count: count() }).from(quotations).where(...)` to return the `total` count.
  5. Update the UI in `page.tsx` to include simple "Previous" and "Next" buttons that update the `page` query parameter.

### 2. Optimize `getProjects` Cost Summation (P2-3)

- **Objective:** Stop fetching all project items into memory to sum their costs. Use a SQL aggregate query instead.
- **Target Files:** `src/actions/project-actions.ts`
- **Implementation Steps:**
  1. Instead of loading `projectItems` just to run a Javascript `reduce()`, utilize Drizzle's `sql` operator or `db.select` with `sum()`.
  2. Join `projects` with `projectItems` and `sum(projectItems.totalPrice)`.
  3. Ensure the result correctly formats the decimal/integer values back to the UI.

### 3. Stop Recalculating `actualTotal` on Read (P2-4)

- **Objective:** `getProject` currently has a side-effect where it recalculates the project's total cost and saves it back to the database every time a project is viewed. This causes unnecessary DB writes.
- **Target Files:** `src/actions/project-actions.ts` (`getProject` function)
- **Implementation Steps:**
  1. Remove the `db.update(projects).set({ actualTotal: ... })` call entirely from the `getProject` query.
  2. The total should ONLY be calculated and saved during mutating actions: `createProject`, `addProjectItem`, `updateProjectItem`, or `deleteProjectItem`. Ensure those actions are handling the recalculation properly.

### 4. Switch to Neon Serverless Driver (P2-9)

- **Objective:** Replace standard `postgres` driver with `@neondatabase/serverless` for better performance and connection pooling on Edge/Serverless environments.
- **Target Files:** `src/lib/db/index.ts`, `package.json`
- **Implementation Steps:**
  1. Run `pnpm add @neondatabase/serverless` and remove `postgres`.
  2. In `src/lib/db/index.ts`, replace `postgres` import with `import { neon } from '@neondatabase/serverless';` and `import { drizzle } from 'drizzle-orm/neon-http';`.
  3. Update initialization: `const sql = neon(process.env.DATABASE_URL!); export const db = drizzle(sql, { schema });`

---

## Part 2: Application Polish

### 5. Use Vitest Consistently (P2-11)

- **Objective:** Drop custom test runner scripts and move to standard Vitest.
- **Target Files:** `src/lib/pricing/run-tests.ts`, `package.json`
- **Implementation Steps:**
  1. Rename `run-tests.ts` to `pricing.test.ts`.
  2. Refactor the custom `assert` logic to use Vitest's `expect()` and `describe/it` blocks.
  3. In `package.json`, update the `test` script to simply run `vitest run`.

### 6. Make Warranty Alert Seeding Idempotent (P2-7)

- **Objective:** Ensure the DB seed script can be run multiple times without duplicating warranty alerts.
- **Target Files:** `src/lib/db/seed.ts`
- **Implementation Steps:**
  1. Before inserting warranty alerts, add a step to either `DELETE FROM warranty_alerts` or utilize an `ON CONFLICT DO NOTHING` if there's a unique constraint on the alert.
  2. Ensure that running `pnpm db:seed` twice yields the exact same row count.

### 7. Restore Pinch-Zoom (P3-2)

- **Objective:** Accessibility fix to allow mobile users to zoom in.
- **Target Files:** `src/app/layout.tsx` (or where the viewport meta tag is defined).
- **Implementation Steps:**
  1. Find the `viewport` export or `<meta name="viewport" ...>` tag.
  2. Remove `user-scalable=no` or `maximum-scale=1`. It should just be `width=device-width, initial-scale=1`.

### 8. Replace Native `confirm()` with `AlertDialog` (P2-14)

- **Objective:** Modernize destructive actions.
- **Target Files:** `src/components/inventory/inventory-card.tsx`, `src/components/quotations/quotation-card.tsx`
- **Implementation Steps:**
  1. Import `AlertDialog`, `AlertDialogContent`, `AlertDialogTrigger`, `AlertDialogAction`, `AlertDialogCancel` from shadcn.
  2. Replace browser `confirm('Are you sure...')` calls inside `handleDelete` functions with the Shadcn modal.

### 9. Centralize `STATUS_CONFIG` (P2-17)

- **Objective:** DRY up status colors across the app.
- **Target Files:** `src/lib/constants.ts` (new file), `src/components/quotations/quotation-card.tsx`, `src/app/(dashboard)/projects/page.tsx`
- **Implementation Steps:**
  1. Extract the `statusConfig` object (which maps status strings like `draft`, `sent`, `accepted` to color classes and Lucide icons) into a shared `constants.ts` file.
  2. Import and use this shared config in all cards, badges, and tables.

### 10. Build the Dashboard "Energy Flow Canvas" (P3-4)

- **Objective:** Add a visual "WOW" factor to the main dashboard.
- **Target Files:** `src/app/(dashboard)/page.tsx`, `src/components/dashboard/energy-flow.tsx` (new)
- **Implementation Steps:**
  1. Create a dynamic, animated SVG or Framer Motion component that represents solar panels feeding energy into a house/battery.
  2. Use vibrant, glowing `solar-amber` colors and micro-animations to simulate energy flow.
  3. Mount this component at the top of the main Dashboard view.

### 11. Add Per-Category Thresholds for Low Stock (P2-13)

- **Objective:** Not all inventory items should warn at `10` stock. Panels might need a warning at `50`, while expensive Inverters warn at `2`.
- **Target Files:** `src/components/inventory/inventory-card.tsx`, `src/lib/validators/inventory.ts`
- **Implementation Steps:**
  1. Define a `STOCK_WARNING_THRESHOLDS` mapping in a constants file (e.g., `panel: 50`, `inverter: 5`, `battery: 10`, `default: 10`).
  2. In `InventoryCard`, update the `getStockColor` function to compare `item.stockQty` against `STOCK_WARNING_THRESHOLDS[item.category]`.
