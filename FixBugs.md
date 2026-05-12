# ROLE: Senior Full-Stack Engineer (Next.js 16 + React 19 + Drizzle ORM)

You are tasked with implementing critical fixes, performance optimizations, and business logic enhancements for the **BOB Solar** project. This is a production-grade solar business management application.

## TECH STACK (Non-Negotiable)

- **Framework:** Next.js 16 (App Router), React 19
- **Database:** Neon PostgreSQL with Drizzle ORM
- **Language:** Strict TypeScript (strict mode enabled)
- **Validation:** Zod for all inputs
- **Architecture:** Server Actions in `src/actions/`, Domain logic in `src/lib/domain`
- **Styling:** Tailwind CSS, Radix UI primitives
- **PWA:** Serwist for service worker
- **State:** React useOptimistic, React.Suspense
- **Animation:** Framer Motion

---

## PRIORITY 1: CRITICAL BUG FIXES (Must Fix First)

### 1.1 Fix N+1 Query in Notifications (`src/actions/notification-actions.ts`)

**Problem:** `dueSoon` and `overdue` warranty alerts use `for` loops with `db.query.notifications.findFirst` and `db.insert` inside, causing N+1 queries.
**Required Fix:**

- Fetch existing notifications in a SINGLE query using `inArray`.
- Collect new notification data into an array.
- Use `db.insert().values(array)` for bulk insert.
- Ensure type safety with Zod schemas.

### 1.2 Fix Soft Delete Inconsistency (`src/actions/customer-actions.ts`)

**Problem:** `getCustomers` filters by `eq(customers.isArchived, false)` but `deleteCustomer` uses `db.delete(customers)` (hard delete).
**Required Fix:**

- Change `deleteCustomer` action to perform soft delete: `db.update(customers).set({ isArchived: true, archivedAt: new Date() })`.
- Ensure cascading behavior does not break related Quotations/Projects.
- Add Zod validation for the delete action input.

### 1.3 Fix Rate Limiting Memory Leak (`src/actions/auth-actions.ts`)

**Problem:** `rateLimitMap` is stored in-memory. In Vercel's serverless environment, memory state is not persistent across requests.
**Required Fix:**

- Replace in-memory `rateLimitMap` with **Vercel KV (Redis)** or database-stored rate limit tracking.
- Implement proper TTL/cleanup logic.
- Ensure rate limiting works correctly in serverless environment.

---

## PRIORITY 2: DATABASE PERFORMANCE OPTIMIZATION

### 2.1 Eliminate N+1 Queries with Drizzle Relational Queries

**Target Files:** `src/actions/project-actions.ts` and similar action files.
**Required Fix:**

- Replace manual looped queries with Drizzle's relational queries: `db.query.projects.findMany({ with: { costs: true, customer: true } })`.
- Audit ALL action files for N+1 patterns and refactor them.

### 2.2 Optimize Text Search with GIN Indexes

**Problem:** `ilike(customers.name, '%...%')` queries are slow on large datasets.
**Required Fix:**

- Create migration to enable `pg_trgm` extension.
- Add GIN indexes on frequently searched text columns (customers.name, projects.name, etc.).
- Ensure migrations are idempotent and placed in `src/db/migrations/`.

### 2.3 Implement Data Caching Layer

**Problem:** Static data (Inventory Items, Settings) is fetched from DB on every request.
**Required Fix:**

- Integrate **Vercel KV** for caching infrequently changed data.
- Implement cache invalidation logic on data mutations.
- Add cache wrapper utility in `src/lib/cache.ts` with type-safe get/set methods.

---

## PRIORITY 3: UI/UX PREMIUM ENHANCEMENTS

### 3.1 Implement Optimistic UI Updates

**Target:** Status changes, item deletions, form submissions.
**Required Fix:**

- Use React 19's `useOptimistic` hook in client components.
- Update UI immediately before Server Action response.
- Rollback gracefully on error with toast notification.

### 3.2 Replace Spinners with Skeleton Loaders

**Target:** All data-fetching pages and components.
**Required Fix:**

- Create reusable Skeleton components matching Card/Table layouts.
- Wrap data-fetching components with `React.Suspense`.
- Remove `Loader2` spinners from primary content areas.

### 3.3 Add Micro-Interactions

**Required Fix:**

- Button click: `scale: 0.98` transition (150ms, ease-out).
- Modal open: Spring animation using Framer Motion.
- Card hover: Subtle shadow and translate-y transitions.
- Ensure all animations respect `prefers-reduced-motion`.

---

## PRIORITY 4: PERFORMANCE OPTIMIZATIONS

### 4.1 Dynamic Imports for Heavy Libraries

**Target:** `react-pdf`, Chart libraries, heavy utilities.
**Required Fix:**

- Use `next/dynamic` with `ssr: false` where appropriate.
- Add loading states for dynamically imported components.
- Verify bundle size reduction.

### 4.2 Service Worker Caching Strategy

**Target:** `serwist` configuration.
**Required Fix:**

- Configure Serwist to cache static assets (fonts, icons, CSS).
- Implement stale-while-revalidate for API responses where safe.
- Ensure offline fallback page works correctly.

### 4.3 Image Optimization

**Target:** All `next/image` usage, especially Vercel Blob images.
**Required Fix:**

- Add explicit `sizes` prop to all `next/image` components.
- Use `priority` prop for above-the-fold images.
- Verify no layout shift occurs.

---

## PRIORITY 5: BUSINESS LOGIC FEATURES (Real-World Workflow)

### 5.1 Quotation Versioning System

**Requirements:**

- When a quotation is edited, create a new version (v1, v2, etc.) instead of overwriting.
- Store version history in a new table: `quotation_versions`.
- UI: Version selector in quotation detail view.
- Ability to view/restore previous versions (view only, no edit old versions).

### 5.2 Inventory Stock Reservation

**Requirements:**

- When a project status changes to `Accepted`, automatically reserve associated inventory items.
- Add `reservedQuantity` column to inventory table.
- Prevent overselling: check available stock = total - reserved before new project acceptance.
- Release reservation if project is cancelled/archived.

### 5.3 Automated Follow-up Reminders

**Requirements:**

- After quotation is sent (status = `Sent`), if no response after 72 hours, auto-create notification for Sales Team.
- Implement using a cron job or Vercel Cron (daily check).
- Add configuration in Settings for follow-up duration (default: 72h).
- Notification should include direct link to quotation.

---

## CODE QUALITY STANDARDS (Strict)

1. **TypeScript:** No `any` types. All functions must have explicit return types.
2. **Zod:** Every Server Action input must be validated with Zod schema.
3. **Error Handling:** All Server Actions must return `{ success: boolean, data?: T, error?: string }` pattern.
4. **Security:** Re-authenticate sensitive actions. Sanitize all inputs.
5. **Database:** Use transactions for multi-step operations.
6. **Testing:** Write unit tests for all new business logic in `src/lib/domain/`.

---

## ACCEPTANCE CRITERIA

- [ ] All N+1 queries eliminated (verified by query logging).
- [ ] Soft delete works consistently across all entities.
- [ ] Rate limiting functions correctly in serverless environment.
- [ ] Database migrations run successfully without errors.
- [ ] UI feels instant (optimistic updates) and smooth (skeletons + animations).
- [ ] Lighthouse performance score > 90.
- [ ] All new features have corresponding Zod schemas and TypeScript types.
- [ ] No build errors (`next build` passes successfully).
- [ ] No regression in existing functionality.

## PROJECT STRUCTURE TO FOLLOW

src/
actions/ # Server Actions only
lib/
domain/ # Business logic, pure functions
cache.ts # New: Cache utilities
db/ # Drizzle schema & migrations
components/
ui/ # Reusable UI primitives
skeletons/ # New: Skeleton components
app/ # Next.js App Router

Do NOT modify `next.config.mjs` unless explicitly instructed. The build blockers have already been resolved. Focus on the logic, performance, and feature implementations above.

Work systematically through priorities. Confirm completion of each priority before moving to the next.
