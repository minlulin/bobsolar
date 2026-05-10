## Phase 1 — 🔴 Critical Security & Auth

> **Goal**: Secure session handling with `iron-session`, fix credentials, add rate limiting. Since all 3 users are equal peers, RBAC gating is **not needed** — just solid authentication.

- [x] **1.1** `dependencies` vs `devDependencies` _(Agent B #1)_
  - **File**: `package.json`
  - **Fix**: Move all runtime-imported packages (`drizzle-orm`, `framer-motion`, `@tanstack/react-query`, `zod`, `bcryptjs`, `@react-pdf/renderer`, etc.) from `devDependencies` → `dependencies`
  - **Verify**: `pnpm install --prod` → app starts without missing modules

- [x] **1.2** Migrate to `iron-session` encrypted cookies _(Agent A: AUTH-001)_
  - **File**: `src/lib/auth/session.ts`
  - **Fix**: Replace raw `session_id` cookie with `iron-session` encrypted/sealed cookies using `SESSION_SECRET`
  - **Also**: Remove `sessions` DB table if session data moves fully into the cookie, OR keep DB sessions but seal the cookie value

- [x] **1.3** Revoke sessions on password change _(Agent A: AUTH-008)_
  - **Files**: `src/actions/auth-actions.ts` (~lines 75-78), `src/actions/settings-actions.ts` (~lines 236-239)
  - **Fix**: After password hash update → invalidate all sessions for that user (except current for self-service)

- [x] **1.4** Remove stale `role` from sessions _(Agent A: AUTH-002)_
  - **Fix**: Read role from `users` table in `requireAuth` instead of trusting cached `sessions.role`
  - **Note**: With 3 equal peers this is less critical, but still a correctness fix

- [x] **1.5** Replace `Math.random` temp password _(Agent A: AUTH-009)_
  - **File**: `src/actions/settings-actions.ts` (~line 32)
  - **Fix**: Use `crypto.randomBytes(16).toString('hex')` or `crypto.randomUUID()`

- [x] **1.6** Secure seed script _(Both: HC-001 / Security)_
  - **File**: `src/lib/db/seed.ts`
  - **Fix**: Read `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` from env; reject defaults like `admin123`
  - **Also**: Remove admin email placeholder from login page (`src/app/(auth)/login/page.tsx` ~line 141)

- [x] **1.7** Add login rate-limiting _(Both: AUTH-007 / #10)_
  - **File**: `src/actions/auth-actions.ts` (~lines 15-40)
  - **Fix**: In-memory `Map` with TTL (sufficient for 3-person team); lockout after N failures; uniform timing for missing users

- [x] **1.8** ~~Admin-gate settings/project/warranty/notifications~~ → **DONE**
  - **Reason**: All 3 users are equal peers. `requireAuth()` is sufficient. Remove misleading admin-only UI hiding in `nav-orbit.tsx` — show Inventory to everyone.
  - **Action**: Ensure `nav-orbit.tsx` shows all nav items to all authenticated users
  - **Action**: Remove any `isAdmin` checks that hide UI features (settings tabs, mark-completed button, etc.)

---
