# BOB Solar Fix Tasks

## Sprint 1: Stop the Bleeding (P0)

### Database Schema & Core Actions
- [x] Add `discountPercentage` to `quotation_items` and fix data loss on edit (P0-2)
- [x] Update pricing engine to use integer math to prevent silent rounding drift (P0-5)
- [x] Fix sequence generation race condition in quotation and project actions (P0-10)
- [/] Lock down `/api/upload` with origin checks, MIME validation, and folder sanitization (P0-9)

### Quotes Workflow Fixes
- [ ] Fix "Review & Send" button so it actually transitions quote state to `sent` (P0-1)
- [ ] Prevent `updateQuotation` from clobbering fields like discount/tax when missing (P0-4)
- [ ] Reset the Zustand store on `/quotations/new` mount (P0-3)

### UI & Experience
- [ ] Build a Notification panel in the layout to display project budget overruns and completions (P0-6)
- [ ] Create `error.tsx`, `loading.tsx`, and `not-found.tsx` to handle uncaught errors properly (P0-7)
- [ ] Create `company_settings` schema, build Settings UI to input company data, and update PDF generator to read from DB (P0-8)

---

## Sprint 2: Fix UX Deception (P1)

### Database Schema & Action Cleanups
- [ ] Add `.notNull()` constraints to quotation decimal columns (P1-12)
- [ ] Remove `id` from being updated in spread-assignments (P1-13)
- [ ] Implement soft delete (archiving) for Customers (P1-9)
- [ ] Fix session expiration and cleanup logic (P1-3)
- [ ] Validate bulk update prices inputs using Zod (P1-14)

### Quotes & PDF Polish
- [ ] Wire up "Delete Draft" dropdown and only show it for drafts (P1-5)
- [ ] Display real creator's name on quote cards instead of "Sales Team" (P1-4)
- [ ] Allow `accepted` quotes to transition back to `rejected` or `draft` (P1-6)
- [ ] Implement automatic transition or filter for `expired` quotes (P1-11)
- [ ] Remove `'use client'` from PDF renderer and bundle fonts locally (P1-16, P1-17)

### Application Setup & UI
- [ ] Move runtime packages from `devDependencies` to `dependencies` (P1-15)
- [ ] Hide admin-only UI controls (like editing Inventory) for non-admin staff (P1-7)
- [ ] Add number validation for input fields like inline price/stock edits (P1-8)
- [ ] Build basic Settings page for User Management and Password change UI (P1-18)
- [ ] Add Logout button to User avatar dropdown menu (P1-19)

---

## Sprint 3: Performance + Polish (P2/P3)

### Performance optimizations
- [ ] Add pagination to `getQuotations` (P2-2)
- [ ] Optimize `getProjects` cost summation (single aggregated query) (P2-3)
- [ ] Stop recalculating and saving `actualTotal` on read in `getProject` (P2-4)
- [ ] Switch to Neon serverless driver (P2-9)

### Application Polish
- [ ] Use Vitest consistently, drop `run-tests.ts` (P2-11)
- [ ] Make warranty alert seeding idempotent (P2-7)
- [ ] Build the Dashboard "Energy Flow Canvas" (P3-4)
- [ ] Restore pinch-zoom by removing `userScalable: false` (P3-2)
- [ ] Centralize `STATUS_CONFIG` for consistent toast colors (P2-17)
- [ ] Add per-category thresholds for low stock warnings (P2-13)
- [ ] Replace native `confirm()` with shadcn `AlertDialog` (P2-14)
