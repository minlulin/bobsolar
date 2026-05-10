## Phase 4 — 🔵 Validation & Business Logic Hardening

> **Goal**: Every server action boundary uses Zod parsing; business state transitions are safe.

- [x] **4.1** Zod-parse all server action inputs _(Agent A: BL-004)_
  - **Files**: `src/actions/customer-actions.ts` (~line 16), `inventory-actions.ts` (~line 19), `project-actions.ts` (~line 300)
  - **Fix**: Add `.parse(filter)` calls using existing or new Zod schemas for every exported action's input

- [x] **4.2** Validate UUID parameters everywhere _(Agent A: BL-005)_
  - **Create**: Shared `uuidSchema = z.string().uuid()` in `src/lib/validators/common.ts`
  - **Apply**: In every action/route that accepts an `id` parameter

- [x] **4.3** Block quote reopening after project conversion _(Agent A: BL-001)_
  - **File**: `src/actions/quotation-actions.ts` (~lines 277-312)
  - **Fix**: Before allowing `accepted → draft` transition, check if a linked project exists; if so, reject

- [x] **4.4** Unique constraint on `projects.quotation_id` _(Agent A: BL-002)_
  - **File**: `src/lib/db/schema.ts` (~line 190), new migration
  - **Fix**: Add `UNIQUE` index on `quotation_id WHERE quotation_id IS NOT NULL`; wrap conversion in a transaction

- [x] **4.5** Idempotent project completion _(Agent A: BL-003)_
  - **File**: `src/actions/project-actions.ts` (~lines 511-522)
  - **Fix**: Use conditional update `WHERE status != 'completed'`; unique warranty keys per project/alert-type
  - **Status**: ✅ Already done — `applyProjectCompletion` uses `ne(projects.status, 'completed')` and seed only runs when `wasNewlyCompleted` is true

- [x] **4.6** Notification deduplication _(Both: BL-006 / #8)_
  - **File**: `src/actions/notification-actions.ts`
  - **Fix**: Add `notification_dedupe_key` column or event table; upsert by event/date/user
  - **Status**: ✅ Already done — `notification_dedupe_key` column exists in schema; `createNotification` uses dedupe keys; `runScheduledNotificationChecks` passes dedupe keys like `quote-expiring-{id}` and `warranty-due-soon-{id}`

- [x] **4.7** Move quotation expiry off list reads _(Agent B #6)_
  - **File**: `src/actions/quotation-actions.ts` (`getQuotations`)
  - **Fix**: Removed bulk `UPDATE ... SET status='expired'` from `getQuotations`. Auto-expiry now only happens on-demand in `getQuotation` (single record scope)

- [x] **4.8** Fix quote number allocation concurrency _(Agent B #7)_
  - **File**: `src/actions/quotation-actions.ts` (`createQuotation`)
  - **Fix**: Added `AdvisoryLock` (PostgreSQL `pg_try_advisory_lock`) wrapping the sequence-read + insert in `createQuotation`. New file: `src/lib/utils/advisory-lock.ts`. Retry on `23505` unique_violation still present as fallback.

- [x] **4.9** Fix dashboard conversion rate formula _(Agent A: BL-007)_
  - **File**: `src/actions/dashboard-actions.ts` (~lines 175-178)
  - **Fix**: Changed from `accepted / sent * 100` to `accepted / (accepted + rejected + expired + sent) * 100`. Added queries for rejected/expired counts.

- [x] **4.10** Fix login redirect handling _(Both: UX-002 / #5)_
  - **Files**: `src/actions/auth-actions.ts` (~line 150), `src/app/(auth)/login/page.tsx` (~lines 50-60)
  - **Fix**: `login()` now returns `{ success: true }` instead of calling `redirect('/')`. Login page uses `router.push('/')` on success. This avoids the `NEXT_REDIRECT` error being caught by the try/catch.

---
