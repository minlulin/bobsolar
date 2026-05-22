# BOB Solar Pre-Production Fix Plan

Source audit reviewed: `docs/bobsolar_pre_production_audit_report.md`  
Plan type: Verified findings only, low-risk execution order, regression-safe rollout.

## Goals

- Fix confirmed auth/security risks first.
- Avoid permission regressions in finance and admin workflows.
- Ship with measurable verification gates (`typecheck`, `lint`, `test`, `build`).

## Working Rules

- Apply minimal scoped changes per task.
- Do not combine policy changes and refactors in one commit.
- For auth changes, update tests in same task.
- Use feature-flagged rollout only if any task affects live session behavior unexpectedly.

## Phase 0 - Baseline & Safety

- [ ] Create branch for pre-production hardening.
- [ ] Capture baseline by running:
  - [ ] `pnpm typecheck`
  - [ ] `pnpm lint`
  - [ ] `pnpm test`
  - [ ] `pnpm build`
- [ ] Record current behavior for:
  - [ ] unauthenticated access to protected pages
  - [ ] authenticated non-admin access to finance pages
  - [ ] upload success/failure paths

## Phase 1 - Access Control Contract (Highest Priority)

### Problem

- `requireFinanceAccess()` is currently admin-only.
- Unauthorized authenticated users are redirected to `/` instead of a dedicated unauthorized route.

### Tasks

- [ ] Define and document access policy for current role model (`admin`, `staff`).
- [ ] Update `src/lib/auth/validate.ts`:
  - [ ] ensure unauthenticated users redirect to `/login`
  - [ ] ensure authenticated-but-forbidden users redirect to `/unauthorized`
  - [ ] align `requireFinanceAccess()` behavior with approved policy
- [ ] Add `/unauthorized` page if missing.
- [ ] Update auth tests:
  - [ ] `src/lib/auth/validate.test.ts`
  - [ ] any action tests asserting old `REDIRECT:/` behavior

### Verification

- [ ] Non-authenticated user hitting protected route -> `/login`
- [ ] Authenticated `staff`/`admin` behavior matches documented policy
- [ ] Finance pages/actions no longer fail due to incorrect gate

## Phase 2 - Upload Endpoint Hardening (Security)

### Problem

- Upload route has no rate limiting.
- Folder input is sanitized but not strict allow-listed.
- MIME-only validation can be spoofed.

### Tasks

- [ ] Add upload rate limiting to `src/app/api/upload/route.ts`:
  - [ ] key by `userId` (primary), IP fallback
  - [ ] bounded window and request cap
  - [ ] return `429` with clear JSON error
- [ ] Replace free-form folder handling with allow-list mapping.
- [ ] Add magic-byte signature checks for JPEG/PNG/WebP before upload.
- [ ] Keep existing size guard (`UPLOAD_MAX_SIZE_BYTES`) and unauthorized guard.

### Verification

- [ ] Valid image uploads still succeed.
- [ ] Invalid type/spoofed file rejected.
- [ ] Burst upload attempts receive `429`.
- [ ] No path traversal-capable folder values accepted.

## Phase 3 - Session Security Policy Tightening

### Problem

- Session TTL is 180 days, too long for production business use.

### Tasks

- [ ] Update `src/lib/domain/policies.ts`:
  - [ ] reduce `SESSION_TTL_MS` to approved value (recommended: 30 days)
  - [ ] ensure `SESSION_TTL_SECONDS` remains derived
- [ ] Validate session refresh behavior in `src/lib/auth/session.ts` remains correct.
- [ ] Optional write-amplification guard:
  - [ ] add refresh debounce strategy only if needed after profiling

### Verification

- [ ] Login creates expected cookie max age.
- [ ] Existing active session refreshes correctly.
- [ ] Expired session behavior unchanged (forced login).

## Phase 4 - UX/Perf Cleanup (Non-Blocking)

### Problem

- Theme provider mount detection uses unconventional `useSyncExternalStore` pattern.
- Dashboard logo fallback handling can be improved.

### Tasks

- [ ] Simplify mounted logic in `src/components/providers.tsx`:
  - [ ] replace no-op `useSyncExternalStore` with explicit mount state pattern
- [ ] Evaluate adding graceful image fallback for critical branding surfaces.
- [ ] Keep image optimization defaults unless there is a documented reason to opt out.

### Verification

- [ ] No theme flicker regression on initial load.
- [ ] Theme toggle still persists and applies correctly.
- [ ] Dashboard header renders correctly with/without image load failures.

## Phase 5 - Final Regression Sweep

- [ ] Run full gates:
  - [ ] `pnpm typecheck`
  - [ ] `pnpm lint`
  - [ ] `pnpm test`
  - [ ] `pnpm build`
- [ ] Manual smoke checklist:
  - [ ] login/logout/session expiry path
  - [ ] finance access with each role
  - [ ] upload happy path + invalid path + rate-limited path
  - [ ] dashboard navigation and theming
- [ ] Prepare deployment notes and rollback points.

## Suggested Commit Sequence

1. `auth: normalize access redirects and finance gate policy`
2. `security: harden upload route with allowlist, signature checks, rate limit`
3. `security: reduce session ttl and validate refresh behavior`
4. `ui: simplify theme provider mount handling and fallback polish`
5. `chore: finalize regression checks and docs updates`

## Out of Scope (Track Separately)

- Full RBAC redesign beyond current `admin|staff` model.
- Broad dashboard query caching changes without profiling evidence.
- Generic accessibility audits unrelated to verified code issues.
