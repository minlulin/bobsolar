# Strict TypeScript + Biome/Lefthook Alignment Plan

Date: 2026-05-18
Repo: `C:\bobsolar`

## Scope
- Enforce strict TypeScript policy and Biome-only lint/format workflow.
- Remove residual legacy lint/hook artifacts (Husky/ESLint/Oxlint remnants) where applicable.
- Continue finance ledger work with dynamic expense payment-method credit mapping (already partially wired), then validate end-to-end.

## Current Context Snapshot
- `package.json`
  - Uses `biome` scripts for lint/format/check.
  - Uses `lefthook` via `prepare` script.
  - `green:code` uses `typecheck + biome:check + test:code`.
- `biome.json`
  - Biome is active and includes `noExplicitAny: error`.
- `lefthook.yml`
  - pre-commit runs `pnpm biome check --write {staged_files}`.
  - pre-push runs `pnpm green:code`.
- `tsconfig.json`
  - Strict flags are enabled (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, etc.).
  - `moduleResolution: "bundler"`, TS 6.0.3 in repo.
- Drift points detected
  - `.husky/_*` scripts still exist and proxy to Lefthook.
  - `.agents/AGENTS.md` references `.agents/skills/code-pattern-shifts-2026/*` paths that are currently missing.

## Plan (No Code Changes Yet)
1. Baseline and lock policy
- Confirm final policy source-of-truth:
  - TypeScript strictness in `tsconfig.json`.
  - Biome-only lint/format in `biome.json` + `package.json` scripts.
  - Lefthook-only hooks in `lefthook.yml`.
- Produce an explicit acceptance checklist for this repo.

2. Remove legacy tooling artifacts
- Remove `.husky` wrapper scripts if no workflow depends on them.
- Replace any residual `eslint-*` directives/comments with Biome-compatible alternatives or code fixes.
- Search for remaining references to `eslint`, `oxlint`, and Husky across docs/scripts/config.

3. Tighten strict TypeScript enforcement
- Audit for explicit/implicit `any`, unsafe casts, and non-null assertions.
- Fix violations without weakening compiler/lint rules.
- Keep strict flags enabled; do not relax `tsconfig`.

4. Finance flow completion (functional target)
- Finalize expense payment-method path so expense journal credit account maps from selected payment method (cash/kbz/wave/aya/bank).
- Ensure UI/API payload for cost creation always includes `paymentMethodId`.
- Validate SSoT mapping parity between income and expense posting paths.

5. Test and quality gates
- Run and pass:
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm test` (or scoped tests first, then full suite as needed)
  - `pnpm build`
- Verify hook behavior with Lefthook in a dry-run style command where feasible.

6. Documentation updates
- Update repo docs where they still imply legacy tooling.
- Add a short "Tooling Policy" note: Biome + Lefthook only, strict TS mandatory.

## Execution Order
1. Tooling drift cleanup (safe config/docs)  
2. Strict TS violation cleanup  
3. Finance expense-method completion and validation  
4. Full green gates + final report

## Risks and Mitigations
- Risk: Removing `.husky` wrappers may affect contributors with stale local hooks.
  - Mitigation: ensure `prepare` keeps `lefthook install`; document one-time reinstall step.
- Risk: Strict TS cleanup may surface latent type issues in edge files.
  - Mitigation: fix incrementally with focused test runs before full build.
- Risk: Finance mapping changes can alter accounting outcomes.
  - Mitigation: add/extend targeted ledger tests for expense credit mapping by payment method.

## Definition of Done
- No dependency on Husky/ESLint/Oxlint remains in active workflow.
- TypeScript strict gates remain fully enabled and passing.
- Biome + Lefthook enforce lint/format and pre-push quality gate.
- Expense ledger credit side correctly maps from selected payment method.
- `typecheck`, `lint`, `test`, and `build` pass.
