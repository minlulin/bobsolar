## Phase 3 — 🟡 SSoT & Code Quality

> **Goal**: Eliminate all duplicated enums, constants, and formatting helpers.

- [x] **3.1** Centralize domain enums _(Agent A: SSOT-001)_
  - **Create**: `src/lib/domain/enums.ts` — export enum value arrays from Drizzle `enumValues` or one canonical source
  - **Update**: Remove duplicated enum arrays from `src/lib/validators/quotation.ts`, `src/lib/validators/project.ts`, `src/hooks/use-quotations.ts`, `project-detail-shell.tsx`, `user-management-tab.tsx`, `settings-actions.ts`
  - **Derive**: Build Zod schemas, UI label maps, and status transition maps from that single source

- [x] **3.2** Unify `ActionResponse` _(Agent A: SSOT-002)_
  - **Keep**: `src/lib/utils/action-response.ts` as the single source
  - **Remove**: Duplicate `ActionResponse<T>` from `src/actions/inventory-actions.ts` (~line 15)
  - **Update**: All action files → import from `src/lib/utils/action-response.ts`

- [x] **3.3** Deduplicate currency formatting _(Agent A: SSOT-003)_
  - **Keep**: `formatMMK` in `src/lib/utils.ts` (or move to `src/lib/domain/formatting.ts`)
  - **Remove**: Duplicate in `src/lib/pricing/engine.ts` (~line 57)

- [x] **3.4** Type-safe settings keys _(Agent A: SSOT-004)_
  - **Create**: `CompanySettingKey` const object + Zod schema in `src/lib/domain/settings-keys.ts`
  - **Update**: `src/actions/settings-actions.ts`, `src/app/(dashboard)/settings/page.tsx`, seed, PDF

- [x] **3.5** Centralize business policy constants _(Agent A: HC-003)_
  - **Create**: `src/lib/domain/policies.ts`
  - **Move into it**: Session TTL (`7d`), upload max size (`5MB`), warranty windows (`30/7/3 days`), budget threshold (`1.1`), user cap (`3`)
  - **Update**: All files that hardcode these values → import from `policies.ts`

- [x] **3.6** Externalize PDF bank/company fallbacks _(Agent A: HC-002)_
  - **File**: `src/components/pdf/quote-document.tsx` (~lines 28-38)
  - **Fix**: Read company identity, tax ID, and bank details from validated company settings, not hardcoded fallback

---
