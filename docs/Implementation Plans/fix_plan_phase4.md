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

- [ ] **4.4** Unique constraint on `projects.quotation_id` _(Agent A: BL-002)_
  - **File**: `src/lib/db/schema.ts` (~line 190), new migration
  - **Fix**: Add `UNIQUE` index on `quotation_id WHERE quotation_id IS NOT NULL`; wrap conversion in a transaction

- [ ] **4.5** Idempotent project completion _(Agent A: BL-003)_
  - **File**: `src/actions/project-actions.ts` (~lines 511-522)
  - **Fix**: Use conditional update `WHERE status != 'completed'`; unique warranty keys per project/alert-type

- [ ] **4.6** Notification deduplication _(Both: BL-006 / #8)_
  - **File**: `src/actions/notification-actions.ts`
  - **Fix**: Add `notification_dedupe_key` column or event table; upsert by event/date/user

- [ ] **4.7** Move quotation expiry off list reads _(Agent B #6)_
  - **File**: `src/actions/quotation-actions.ts` (`getQuotations`)
  - **Fix**: Move `UPDATE quotations SET status='expired'` to a background cron job or on-demand narrow update, not inside list action

- [ ] **4.8** Fix quote number allocation concurrency _(Agent B #7)_
  - **File**: `src/actions/quotation-actions.ts` (`createQuotation`)
  - **Fix**: DB sequence, advisory lock, or `INSERT ... ON CONFLICT RETRY` strategy

- [ ] **4.9** Fix dashboard conversion rate formula _(Agent A: BL-007)_
  - **File**: `src/actions/dashboard-actions.ts` (~lines 175-178)
  - **Fix**: `accepted / (accepted + rejected + expired + sent)` over a defined period

- [ ] **4.10** Fix login redirect handling _(Both: UX-002 / #5)_
  - **Files**: `src/actions/auth-actions.ts` (~line 40), `src/app/(auth)/login/page.tsx` (~lines 50-60)
  - **Fix**: Return a typed success result instead of throwing `redirect()` inside try/catch; let the client handle navigation. OR use `isRedirectError` / `unstable_rethrow`

---
