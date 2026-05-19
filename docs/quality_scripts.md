# Quality Scripts Guide

Use these `pnpm` scripts to keep code, tests, and DB checks green before deployment.

## Core Quality Gates

- `pnpm green:code`  
  Runs code-only gate: typecheck, Biome check, and non-DB tests.

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

## Lint / Format Commands

- `pnpm lint`  
  Runs Biome lint rules.

- `pnpm biome:check`  
  Runs Biome lint + formatting diagnostics.

- `pnpm biome:fix`  
  Applies Biome safe fixes and formatting changes.

- `pnpm format`  
  Formats repository with Biome.

- `pnpm format:check`  
  Checks formatting with Biome.

## Database Commands

- `pnpm db:migrate`  
  Runs migrations using default DB config (`DATABASE_URL`).

- `pnpm db:baseline`  
  Backfills `drizzle.__drizzle_migrations` from local migration files when the
  history table is empty but schema already exists (recovery command for Neon branch/state drift).

- `pnpm db:migrate:test`  
  Runs schema push against test DB config (`TEST_DATABASE_URL`) via `drizzle.test.config.ts`.
  Use this for cloned/resettable test branches where migration history may not match.

- `pnpm db:test:ping`  
  Quick connectivity probe for `TEST_DATABASE_URL` (fails fast with actionable
  network/auth output before migration/test steps).

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
- Recommended for test migrations:
  - `TEST_DATABASE_URL_DIRECT` (direct Neon endpoint, non-pooler) used by
    `db:migrate:test` to avoid PgBouncer/pooled migration issues
- DB tests require network access to Neon.
