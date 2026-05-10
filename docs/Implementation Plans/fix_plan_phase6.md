## Phase 6 — 🟣 TypeScript Strictness

> **Goal**: Achieve the zero-tolerance strict TypeScript policy.

- [ ] **6.1** Enable missing strict compiler flags *(Agent A: TS-001)*
  - **File**: `tsconfig.json`
  - **Add**: `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`
  - **Set**: `allowUnusedLabels: false`, `allowUnreachableCode: false`

- [ ] **6.2** Split service-worker tsconfig *(Agent A: TS-003)*
  - **Create**: `tsconfig.sw.json` for `src/sw.ts` — uses `webworker` lib only
  - **Update**: Root `tsconfig.json` — remove `webworker` from `lib`, keep `dom`/`dom.iterable`

- [ ] **6.3** Fix local strict-pass violations *(Agent A: TS-002)*
  - `notification-bell.tsx:46` — ensure all code paths return a value
  - `src/lib/db/index.ts` — fix `noPropertyAccessFromIndexSignature` violations
  - `src/lib/storage/blob.ts:5` — same fix
  - Remove unused React imports in TSX files

- [ ] **6.4** Remove unsafe casts and non-null assertions *(Agent A: TS-004)*
  - Replace `as Record<string, unknown>` casts with Zod `.parse()` at boundaries
  - Replace `!` assertions with proper null checks or early returns
  - **Files**: `customer-actions.ts:109`, `inventory-actions.ts:113`, `quotation-actions.ts:101/156`, `quote-preview.tsx:24`, `quote-editor.tsx:81`, `project/new/page.tsx:211`

- [ ] **6.5** Pin TypeScript version *(Agent A: DEPLOY-002)*
  - **File**: `package.json`
  - **Fix**: Change `"typescript": "^6.0.3"` → `"typescript": "6.0.3"` (exact)

---