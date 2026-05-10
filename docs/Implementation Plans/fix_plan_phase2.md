## Phase 2 — 🟠 Deployment & PWA Blockers

> **Goal**: Fix anything that prevents reliable deploy or breaks PWA installability.

- [ ] **2.1** Fix manifest URL mismatch *(Both: PWA-001 / #4)*
  - **File**: `src/app/layout.tsx` (~line 34)
  - **Fix**: Change `manifest: '/manifest.json'` → `manifest: '/manifest.webmanifest'`

- [ ] **2.2** Restore missing static assets *(Agent B #4)*
  - **Dirs**: `public/icons/`, `public/fonts/`
  - **Fix**: Ensure all icons referenced in `src/app/manifest.ts` and all fonts in `src/components/pdf/quote-document.tsx` exist in `public/`
  - **Verify**: CI step to assert required asset paths exist

- [ ] **2.3** Lazy DB initialization *(Both: DB-001 / Next.js audit)*
  - **File**: `src/lib/db/index.ts`
  - **Fix**: Replace module-scope `export const db = ...` with `let _db; export function getDb() { if (!_db) { _db = drizzle(...) } return _db }`
  - **Also**: Remove `dotenv.config()` from this file (DB-002). Keep dotenv only in CLI scripts (`drizzle.config.ts`, seed)

- [ ] **2.4** Add migration step to deployment *(Agent A: DEPLOY-001)*
  - **File**: `vercel.json`
  - **Fix**: Add `pnpm drizzle-kit push` or `drizzle-kit migrate` before build, or document a mandatory pre-deploy step with rollback

- [ ] **2.5** Handle Serwist + Turbopack conflict *(Both: PWA-002)*
  - **File**: `next.config.ts`, `package.json` scripts
  - **Fix**: Use `next dev` (webpack mode) in dev script, OR conditionally skip Serwist in dev mode

- [ ] **2.6** Delete `proxy.ts` *(Agent B #9)*
  - **File**: `src/proxy.ts`
  - **Fix**: Delete `proxy.ts` — it's dead code. Auth is layout-based via `requireAuth()` in `(dashboard)/layout.tsx`. Document this boundary in README.

---