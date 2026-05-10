# Audit Result by Cursor

Evidence-based audit of the BOB Solar codebase (TypeScript, Next.js, PWA). Findings derive from source, configuration, dependency declarations, and local verification (`pnpm typecheck`, `pnpm test`, `pnpm build`) unless noted as manual verification.

---

## Executive Summary

This is a coherent internal Next.js App Router + Drizzle (Neon) + server actions application with strict TypeScript and a thin HTTP API (`/api/upload`, quotations PDF route). Dashboard access is enforced in the `(dashboard)` layout via `requireAuth()`, not via a first-party `middleware.ts` that wraps `proxy.ts`. Authorization is inconsistent (`requireAuth` vs UI-only hiding). Critical libraries appear under `devDependencies`, which breaks installs that omit dev deps. The workspace snapshot lacked `public/icons/*` and `public/fonts/*` referenced by the app—risk broken UI/PWA/PDF unless assets ship elsewhere. Automated tests cover pricing only (16 tests); no `.github/workflows` in-repo. **Pilot-ready for a small trusted team; not production-grade without remediation.**

---

## Top 10 Highest-Impact Findings

### 1. Runtime deps classified as devDependencies

| Field | Detail |
|--------|--------|
| **Severity** | Critical |
| **File(s)** | `package.json` |
| **Evidence** | `drizzle-orm`, `framer-motion`, `@tanstack/react-query`, `zod`, `bcryptjs`, `@react-pdf/renderer`, etc., live under `devDependencies` while imported by runtime code. |
| **Impact** | Broken deployments where prod installs omit devDependencies; PDF/features failing inconsistently across environments. |
| **Recommended fix** | Move all runtime-used packages to `dependencies`; keep tooling/tests/build-only under `devDependencies`. |
| **Effort** | S |

### 2. Company-wide sensitive settings writable by any authenticated user

| Field | Detail |
|--------|--------|
| **Severity** | High |
| **File(s)** | `src/actions/settings-actions.ts` (`updateCompanySettings`, related callers). |
| **Evidence** | `updateCompanySettings` calls `requireAuth()` only and merges arbitrary keys into `companySettings`. |
| **Impact** | Staff accounts may alter bank/tax/contact/logo-backed URLs—independence/security/policy violations. |
| **Recommended fix** | Restrict to `requireAdmin()` or granular roles; allow-list keys; optionally isolate secrets/finance rows. |
| **Effort** | M |

### 3. Inventory APIs expose catalog without enforcing dock/UI restrictions

| Field | Detail |
|--------|--------|
| **Severity** | High |
| **File(s)** | `src/actions/inventory-actions.ts`, `src/components/layout/nav-orbit.tsx` |
| **Evidence** | `getInventoryItems` / `getInventoryItem` use `requireAuth()` only; dock hides Inventory for non-admins. |
| **Impact** | UI hiding is not enforcement; staff can still retrieve inventory via server actions. |
| **Recommended fix** | Align `requireAdmin()` (or RBAC) with product policy for read and write. |
| **Effort** | S |

### 4. Missing static assets referenced for PDF, PWA, shell

| Field | Detail |
|--------|--------|
| **Severity** | High |
| **File(s)** | `src/components/pdf/quote-document.tsx`; `src/app/layout.tsx`; `src/app/manifest.ts`; `public/` layout in workspace |
| **Evidence** | PDF registers fonts under `public/fonts/...`; metadata/manifest reference `/icons/...`. Workspace search found no `public/fonts` or `public/icons` directories. |
| **Impact** | PDF generation or branding may fail at runtime; icons/manifest/Lighthouse PWA checks may fail. |
| **Recommended fix** | Version assets in repo or CDN; add CI assert that required paths exist. |
| **Effort** | M |

### 5. Login client `try/catch` vs server action `redirect()`

| Field | Detail |
|--------|--------|
| **Severity** | High |
| **File(s)** | `src/app/(auth)/login/page.tsx`, `src/actions/auth-actions.ts` |
| **Evidence** | Client wraps `await login(data)` in try/catch; successful `login()` calls `redirect('/')`, which uses a throw-based control flow in Next.js. |
| **Impact** | Successful sign-in may surface as a client-side error or block redirect (known class of Next.js + server action issues). |
| **Recommended fix** | Avoid catching redirect errors; use `isRedirectError` / `unstable_rethrow` or restructure flow. |
| **Effort** | S |

### 6. Write-on-read in quotation listing

| Field | Detail |
|--------|--------|
| **Severity** | Medium |
| **File(s)** | `src/actions/quotation-actions.ts` (`getQuotations`) |
| **Evidence** | List path runs `UPDATE quotations` to expire sent quotes before returning rows. |
| **Impact** | Extra DB writes and contention on every listing; cost and latency at scale. |
| **Recommended fix** | Move expiry to cron, background job, or narrow on-demand updates. |
| **Effort** | M |

### 7. Quote number allocation under concurrency

| Field | Detail |
|--------|--------|
| **Severity** | Medium |
| **File(s)** | `src/actions/quotation-actions.ts` (`createQuotation`) |
| **Evidence** | Year-scoped “last quote + increment + retry” pattern without a single serialized allocator proven in code. |
| **Impact** | Collisions/retries/user-facing failures when many quotes are created in parallel. |
| **Recommended fix** | DB-backed sequence, advisory lock, or conflict-safe insert strategy. |
| **Effort** | M–L |

### 8. Notification server actions: weak gate + duplicate insert risk

| Field | Detail |
|--------|--------|
| **Severity** | Medium |
| **File(s)** | `src/actions/notification-actions.ts` (`createNotification`, `runScheduledNotificationChecks`) |
| **Evidence** | Both use `requireAuth()` only; scheduling paths insert rows without idempotency keys (if invoked repeatedly). |
| **Impact** | Spam or duplicate notifications if actions are called from client or future UI. |
| **Recommended fix** | `requireAdmin`/internal-only trigger; idempotency dedupe. |
| **Effort** | M |

### 9. `proxy.ts` not wired as Next middleware

| Field | Detail |
|--------|--------|
| **Severity** | Medium |
| **File(s)** | `src/proxy.ts` |
| **Evidence** | Expresses matcher and `proxy` handler but no `src/middleware.ts` default export; nothing imports `proxy`. Page auth relies on `(dashboard)/layout.tsx` + `requireAuth()`. |
| **Impact** | Misleading safety net; future routes outside the layout may ship unauthenticated. |
| **Recommended fix** | Implement official `middleware.ts` or remove dead code after documenting boundaries. |
| **Effort** | S |

### 10. No login rate limiting / lockout

| Field | Detail |
|--------|--------|
| **Severity** | Medium |
| **File(s)** | `src/actions/auth-actions.ts` |
| **Evidence** | `login` validates and checks password without throttling or structured abuse logging. |
| **Impact** | Credential stuffing and undetected compromise attempts on internet-facing deploys. |
| **Recommended fix** | Edge/IP rate limits, optional lockout, audit logs, optional 2FA for admins. |
| **Effort** | M–L |

---

## Architecture Assessment

**Observed structure**

- Next.js App Router: `(auth)/login`, `(dashboard)/*`.
- Auth: HTTP-only cookie `session_id` → `sessions` (`src/lib/auth/session.ts`); `requireAuth` / `requireAdmin` in `src/lib/auth/validate.ts`.
- Data: Drizzle + Neon HTTP (`src/lib/db/index.ts`); schema in `src/lib/db/schema.ts`.
- Mutations: primarily `src/actions/*` server actions.
- HTTP: `src/app/api/upload/route.ts`, `src/app/(dashboard)/quotations/[id]/pdf/route.ts`.
- Client: TanStack Query, Zustand, Framer Motion in several surfaces.

**Strengths:** Clear domain modules; Zod + `ActionResponse` patterns; strict TypeScript compiler options.

**Weaknesses:** Inconsistent authorization vs UI; absent standard middleware; read paths with write side effects; heavy client animation without documented bundle budget.

---

## Security Audit

| Item | Severity | Notes |
|------|-----------|--------|
| Staff can update global company settings | High | `requireAuth` only on bulk settings update. |
| Inventory readable by all authenticated users | High | Server must match nav policy. |
| Notification actions | Medium | `requireAuth`-only; duplication if run repeatedly. |
| Public blob uploads | Contextual | Vercel Blob `access: 'public'`—acceptable for logos only. |
| Session `role` denormalized | Medium | Can diverge from `users.role` until re-login. |
| Seed password | High if misused | `src/lib/db/seed.ts` seeds known password for admin. |
| PDF remote logo URL | Manual check | Remote `Image` URLs in PDF pipeline—SSRF/abuse if URLs are unconstrained. |

---

## TypeScript & Code Quality Audit

- Strict mode and strong schema typing; `pnpm typecheck` succeeded in audit environment.
- Broad `catch { return failure }` hides root causes in some actions.
- `role as UserRole` in `validate.ts` trusts stored session string.

---

## Next.js Audit

- Dynamic dashboard (cookies/DB in layout); SEO mostly irrelevant behind auth.
- Root `metadata` + `manifest.ts` present.
- Serwist warns about Turbopack dev vs webpack in some setups (`next build` output).
- `dotenv` in `src/lib/db/index.ts` logs during build when many workers import DB.

---

## PWA Audit

- `src/sw.ts`: `skipWaiting: true`, `clientsClaim: true`, `defaultCache`—aggressive updates.
- Manifest references icon paths; icons must exist where deployed.
- Offline: expect cached shell, not full offline CRUD.

---

## Performance Audit

- Motion + large client stack on login/dashboard—monitor LCP/INP/TBT.
- Three Google fonts with preload in root layout—bandwidth competition.
- Quotation listing triggers writes—scaling cost.
- `next/image` with `unoptimized` in places (e.g. login branding).

---

## Data & Analytics Audit

- Logging: `console.error` on failures; JSON helpers in `lib/utils/error.ts`.
- No Sentry/Datadog/OpenTelemetry surfaced in audited `src/` paths.
- No product analytics events identified.

---

## Testing & Reliability Audit

- `pnpm test`: 2 files, 16 tests—all under `src/lib/pricing/*.test.ts`.
- No E2E; no workflows under `.github/workflows` in workspace; `vercel.json` build chain does not run tests.

---

## Dependency & Configuration Audit

- `vercel.json`: `pnpm typecheck && pnpm lint && pnpm build`—tests omitted from deploy gate.
- Env usage in audited code: `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, `NODE_ENV`—no `NEXT_PUBLIC_*` misuse found in `src` during audit grep.

---

## Prioritized 30-Day Action Plan

**Week 1 — Critical fixes**

- Correct `dependencies` vs `devDependencies`.
- Restore or repoint icons/fonts; CI guard for missing files.
- Fix login redirect + client error handling.
- Lock company mutations to admins + allow-listed keys.

**Week 2 — Performance/security**

- Move quote expiry off list reads.
- Login rate limiting and basic audit logging.
- Server-side inventory/read policy aligned with UI.
- Tighten upload/PDF remote asset policy.

**Week 3 — Architecture/tests**

- Real `middleware.ts` or remove `proxy.ts` with documented boundaries.
- Harden concurrent quote numbering.
- Vitest for authz matrix / critical actions.

**Week 4 — Polish**

- Error reporting/metrics.
- PWA update UX (`skipWaiting` review); Lighthouse checklist on staging.
- Minimal E2E (e.g. Playwright): login + one money path.
- CI: typecheck, lint, test on PR.

---

## Final Verdict

| Question | Answer |
|----------|--------|
| **Production-ready today?** | **No**—not without fixing dependency layout, authorization on settings/inventory, assets for PDF/PWA, and login/redirect UX. |
| **What blocks scale?** | Write-on-read patterns, Neon-per-query without a broader caching/read strategy, weak enforcement vs UI assumptions, absence of observability and broad tests. |
| **Highest ROI** | Align server RBAC with business roles, normalize dependencies, instrument and test login + quotations + PDFs. |

---

## Assumptions / Manual Verification

- Production install includes devDependencies or fails fast if not.
- Icons/fonts might exist only on deployment hosts or `.gitignore` in another clone.
- Browser validation of login + `redirect` after Next 16 upgrade.
- Proxy headers (`X-Forwarded-Host`) for `/api/upload` origin checks behind custom domains.

---

*Generated from an interactive Cursor-assisted audit session; treat items marked “manual verification” as requiring confirmation on your staging environment.*
