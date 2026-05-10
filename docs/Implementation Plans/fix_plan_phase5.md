## Phase 5 — 🟢 Performance & Scaling

> **Goal**: Prepare the app for growing data without degradation.

- [ ] **5.1** Add operational DB indexes _(Agent A: DB-003)_
  - **File**: New Drizzle migration
  - **Indexes**: `(user_id, is_read, created_at)` on notifications, `(status, created_at)` on quotations/projects, `(is_resolved, due_date)` on warranty_alerts, FK columns

- [ ] **5.2** Paginate customer/inventory lists _(Agent A: BL-008)_
  - **Files**: `src/actions/customer-actions.ts`, `src/actions/inventory-actions.ts`
  - **Fix**: Add `limit`, `offset`/cursor params with a strict max (e.g. 50)

- [ ] **5.3** Parallelize dashboard queries _(Agent A: PERF-001)_
  - **File**: `src/actions/dashboard-actions.ts`
  - **Fix**: Wrap independent DB calls in `Promise.all([ ... ])`

- [ ] **5.4** SSR initial dashboard data _(Agent A: PERF-002)_
  - **File**: `src/app/(dashboard)/page.tsx`
  - **Fix**: Fetch initial data in a Server Component, pass as props or hydrate TanStack Query

- [ ] **5.5** Optimize font loading _(Agent B: Performance)_
  - **File**: `src/app/layout.tsx`
  - **Fix**: Reduce to 1-2 font families; use `next/font` with `display: swap`

---
