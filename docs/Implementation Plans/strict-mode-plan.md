# Maximum Level Strict Mode Implementation Plan

This plan outlines the steps required to elevate the current codebase to the **MAXIMUM** TypeScript strictness level, strictly adhering to the `.agents/skills/typescript-pwa-vercel-deploy/SKILL.md` guidelines.

## 1. Configuration Hardening (No Exceptions)

### 1.1 `tsconfig.json` Updates

- Change `skipLibCheck` from `true` to `false`.
- Change `skipDefaultLibCheck` from `true` to `false`.
- Ensure `outDir` is explicitly mapped if not using Next.js default emit.

### 1.2 `eslint.config.mjs` Escalation

Promote all temporarily weakened (`warn`) rules to `error`:

- `@typescript-eslint/explicit-function-return-type`: `error`
- `@typescript-eslint/explicit-module-boundary-types`: `error`
- `@typescript-eslint/no-floating-promises`: `error`
- `@typescript-eslint/no-misused-promises`: `error`
- `@typescript-eslint/require-await`: `error`
- `@typescript-eslint/no-confusing-void-expression`: `error`

## 2. Code Refactoring

### 2.1 Eliminate Magic Strings/Numbers

- Audit the codebase for plain string and numeric literals used in configuration, routing, or state.
- Replace them with TypeScript `enum`s.
- Add exhaustiveness checks (`never`) in `switch` statements evaluating these enums.

### 2.2 Type Inference Eradication

- Add explicit return types to all functions, React components, and React hooks.
- Provide explicit types for all function parameters (even where historically inferred).

### 2.3 Strict Promise/Async Handling

- Add `.catch()` handlers or `await` to all floating promises.
- Validate that all `try/catch` blocks treat the caught variable as `unknown` and gracefully narrow it (`if (error instanceof Error)`).

### 2.4 Data Validation boundaries

- Verify all external API payloads and database responses are treated as `unknown` initially.
- Ensure type-guards or Zod schemas validate this data before casting.

## 3. PWA and Vercel Validation (Skill Completeness)

- Verify `manifest.webmanifest` and `src/sw.ts` type-check against maximum strict mode.
- Audit `vercel.json` and `package.json` to ensure `pnpm green` strictly executes `tsc --noEmit` and `eslint src --max-warnings=0`.

## 4. Execution Strategy

1. **Branch out**: Create a dedicated `feature/maximum-strict-mode` branch.
2. **Apply Config Changes**: Update `tsconfig.json` and `eslint.config.mjs`.
3. **Iterative Fixes**: Run `pnpm typecheck` and `pnpm lint` continuously, fixing domain by domain (e.g., `src/app`, `src/components`, `src/lib`).
4. **Enforce Green Pipeline**: Ensure `pnpm green` passes without a single warning before merging.
