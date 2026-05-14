# Quality Scripts Guide

Use these `pnpm` scripts to keep code, tests, and DB checks green before deployment.

## Core Quality Gates

- `pnpm green:code`  
  Runs code-only gate: typecheck, lint, format check, and non-DB tests.

- `pnpm green:db`  
  Runs DB gate on test database via `pnpm test:db`.

- `pnpm green`  
  Full local CI gate: `green:code` → `green:db` → production build.

- `pnpm green:quick`  
  Alias of `green:code` for faster iteration.

## Test Commands

- `pnpm test`  
  Runs all Vitest suites.

- `pnpm test:code`  
  Runs non-DB tests only.

- `pnpm test:db`  
  Runs test DB migration first, then DB integration suites:
  - `src/__tests__/db-ugly-path.test.ts`
  - `src/__tests__/db-workflow-master.test.ts`

## Database Commands

- `pnpm db:migrate`  
  Runs migrations using default DB config (`DATABASE_URL`).

- `pnpm db:baseline`  
  Backfills `drizzle.__drizzle_migrations` from local migration files when the
  history table is empty but schema already exists (recovery command for Neon branch/state drift).

- `pnpm db:migrate:test`  
  Runs schema push against test DB config (`TEST_DATABASE_URL`) via `drizzle.test.config.ts`.
  Use this for cloned/resettable test branches where migration history may not match.

- `pnpm db:seed`  
  Seeds database using env values from `.env.local`.

## Recommended Daily Flow

1. `pnpm green:code` during feature work
2. `pnpm green:db` before release
3. `pnpm green` as final deploy gate

## Environment Requirements

- `.env.local` must define:
  - `DATABASE_URL` (production/main branch DB)
  - `TEST_DATABASE_URL` (test branch DB)
- DB tests require network access to Neon.
