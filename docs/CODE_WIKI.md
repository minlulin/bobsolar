# BOB Solar Code Wiki

This document describes the project layout, architecture, runtime flow, key modules, developer workflows, and precise steps to run and test the codebase locally.

**Maintainers:** keep this file concise and update when file locations or scripts change.

## Table of Contents

- Repository layout
- Architecture overview
- Runtime flow (feature mapping)
- Key modules and responsibilities
- Development: run, test, lint, and DB tasks
- Helpful file links (quick jump)
- Where to start reading

## Repository layout

Top-level files and folders (high level):

- `src/` — application code (Next.js App Router, Server Actions, components, hooks, lib, stores)
- `drizzle/` — SQL migrations and migration journal
- `public/` — static assets and built service worker
- `scripts/` — operational scripts (TSX runners)
- `docs/` — repository documentation
- `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `next.config.mjs` — workspace configuration

Project conventions:

- `Server Actions` live under `src/actions/` and act as the application service layer (authorization → validation → DB → side-effects).
- `src/lib/` contains infrastructure and domain helpers (db client, auth, finance, pricing, validators).
- Client data layer uses TanStack Query hooks in `src/hooks/` and local state is in `src/stores/` (Zustand).
- UI routes and layouts are in `src/app/` and follow Next.js App Router patterns.

## Architecture overview

- Layered design: UI (routes + components) → Hooks (client data) → Server Actions (use-cases) → Lib (db/auth/finance)
- Mutations perform input validation with Zod, run DB transactions via Drizzle when required, and call `revalidateTag` / `revalidatePath` to keep caches consistent.
- Concurrency-sensitive sequences (quote/project numbers) use advisory locks via DB helper utilities (implementation may live in db or utils helpers).
- Finance operations always aim to write balanced double-entry journal entries via `src/lib/finance/ledger.ts`.

## Runtime flow (feature mapping)

Common domain flows and their primary entry points:

- Customers: `src/actions/customer-actions.ts` and routes under `src/app/(dashboard)/customers`
- Inventory: `src/actions/inventory-actions.ts` and `src/app/(dashboard)/inventory`
- Quotations: `src/actions/quotation-actions.ts` and `src/app/(dashboard)/quotations`
- Projects: `src/actions/project-actions.ts` and `src/app/(dashboard)/projects`
- Finance reports and ledgers: `src/actions/*-actions.ts` and `src/lib/finance`
- Warranty workflows: `src/actions/warranty-actions.ts` and `src/app/(dashboard)/warranty`

Server Actions pattern:

1. Permission guard (e.g. `requireAuth`, `requireAdmin`) — `src/lib/auth/validate.ts`
2. Input validation (Zod schemas in `src/lib/validators/`)
3. DB queries/transactions via the Drizzle client (`src/lib/db`)
4. Side-effects (ledger entries, notifications)
5. Cache invalidation (`revalidateTag` / `revalidatePath`)

## Key modules and responsibilities

- `src/app/` — route handlers, layouts, error/loading boundaries, and server-side rendering orchestration.
- `src/actions/` — business logic exposed as Server Actions. Each file implements validation, DB transactions, side-effects and returns `ActionResponse`-style results.
- `src/lib/auth/` — session lifecycle and guards (`session.ts`, `validate.ts`).
- `src/lib/db/` — Drizzle client bootstrap and schema definitions (`index.ts`, `schema.ts`).
- `src/lib/finance/` — ledger engine and helpers (`ledger.ts`).
- `src/lib/pricing/` — pure pricing engine used to compute quotation totals (`engine.ts`).
- `src/lib/notifications/` — notification insertion and broadcast helpers.
- `src/lib/validators/` — Zod schemas for inputs and primitives (UUID, amounts).
- `src/hooks/` — TanStack Query wrappers and mutation helpers (`mutation-factory.ts`).
- `src/components/`, `src/stores/` — UI components and client state (Zustand).

## Development: run, test, lint, DB tasks

Prerequisites

- Node.js v24+ (recommended)
- pnpm v7+ (project uses `packageManager` in `package.json`)
- Local Postgres (Neon or local PG) for DB-dependent tests and migrations

Common commands (copy/paste):

- Install dependencies:

```bash
pnpm install
```

- Start dev server:

```bash
pnpm dev
```

- Typecheck and lint:

```bash
pnpm typecheck
pnpm biome:check
```

- Run unit tests:

```bash
pnpm test
```

- Run DB-heavy tests (requires `DATABASE_URL` and test DB configured):

```bash
pnpm test:db
```

- Run migrations (safe in CI if `DATABASE_URL` points to a disposable DB):

```bash
pnpm db:migrate
```

- Seed baseline data (after migrations):

```bash
pnpm db:seed
```

Notes about `.env` and DB:

- Create local env from the example:

```powershell
Copy-Item .\.env.example .\.env.local
```

- Required keys include `DATABASE_URL`, `SESSION_SECRET`, and `BLOB_READ_WRITE_TOKEN` (if using blob uploads).

## Helpful file links (quick jump)

- App root layout: [src/app/layout.tsx](src/app/layout.tsx#L1)
- Dashboard layout: [src/app/(dashboard)/layout.tsx](src/app/(dashboard)/layout.tsx#L1)
- Server Actions folder: [src/actions](src/actions)
- DB client: [src/lib/db/index.ts](src/lib/db/index.ts#L1)
- Schema definitions: [src/lib/db/schema.ts](src/lib/db/schema.ts#L1)
- Session and auth guards: [src/lib/auth/session.ts](src/lib/auth/session.ts#L1), [src/lib/auth/validate.ts](src/lib/auth/validate.ts#L1)
- Ledger engine: [src/lib/finance/ledger.ts](src/lib/finance/ledger.ts#L1)
- Pricing engine: [src/lib/pricing/engine.ts](src/lib/pricing/engine.ts#L1)
- Validators: [src/lib/validators](src/lib/validators)
- Mutation factory: [src/hooks/mutation-factory.ts](src/hooks/mutation-factory.ts#L1)

## Where to start reading

1. `README.md` — project overview and Solar Flow
2. `src/lib/auth/validate.ts` and `src/lib/auth/session.ts` — understand auth and guards
3. `src/lib/db/index.ts` and `src/lib/db/schema.ts` — DB connection and schema
4. `src/actions/quotation-actions.ts` and `src/actions/project-actions.ts` — representative Server Actions showing validation, transactions, and side-effects
5. `src/lib/finance/ledger.ts` — double-entry posting semantics

---

If you'd like, I can also:
- Expand a short developer HOWTO for adding a new Server Action (validation → transaction → side effects), or
- Generate a checklist for safe local DB resets and test runs.

Tell me which follow-up you'd prefer and I'll add it to the docs.# BOB Solar — Code Wiki

This document is a concise, accurate reference for the repository structure, runtime flow, key modules, developer commands, and suggested reading order. Links are workspace-relative.

Contents
- [Repository overview](#repository-overview)
- [Architecture & conventions](#architecture--conventions)
- [Runtime flows (quick map)](#runtime-flows-quick-map)
- [Module reference (by folder)](#module-reference-by-folder)
- [Database & migrations](#database--migrations)
- [Local developer setup](#local-developer-setup)
- [Testing and quality gates](#testing-and-quality-gates)
- [Operational scripts](#operational-scripts)
- [Where to start reading](#where-to-start-reading)

## Repository overview

- Primary language: TypeScript (strict), targeting Node.js + Next.js App Router.
- App root: [src/app](src/app)
- Server actions / use-cases: [src/actions](src/actions)
- Shared infra: [src/lib](src/lib)
- Client hooks: [src/hooks](src/hooks)
- UI components: [src/components](src/components)
- Client state stores: [src/stores](src/stores)
- DB migrations: [drizzle/migrations](drizzle/migrations)
- Dev scripts: [scripts](scripts)

Key files
- Project config: [package.json](package.json), [tsconfig.json](tsconfig.json)
- Lint/format: [eslint.config.mjs](eslint.config.mjs), [biome.json](biome.json)
- Next config: [next.config.mjs](next.config.mjs)

## Architecture & conventions

- Layered boundaries
  - UI / routes: `src/app` — server & client components, layouts, route handlers.
  - Use-case layer: `src/actions` — Server Actions implement permission checks, input validation, DB transactions, side effects, and cache revalidation.
  - Foundation layer: `src/lib` — DB client, auth, finance ledger, validators, utilities. This layer must not import from UI layers.

- Conventions used throughout the codebase
  - Validation-first: inputs are parsed with Zod validators in `src/lib/validators`.
  - Server Actions return an `ActionResponse` shape (see `src/lib/utils/action-response.ts`).
  - Side effects (ledger posts, notifications, file uploads) are explicit and happen inside transactions where atomicity is required.
  - Cache invalidation: uses `revalidateTag` / `revalidatePath` from Next where appropriate.
  - Concurrency: sequence numbers and other serialized operations use advisory locks (`src/lib/utils/advisory-lock.ts`).

## Runtime flows (quick map)

- Typical flow for a user action that mutates domain state:
  1. Client component -> hook in `src/hooks`.
  2. Hook invokes a Server Action in `src/actions`.
  3. Server Action calls `requireAuth` / role guards (`src/lib/auth/validate.ts`).
  4. Server Action validates inputs (`src/lib/validators/*`) and runs DB queries via the Drizzle client (`src/lib/db`).
  5. If needed, Server Action posts journals via `src/lib/finance/ledger.ts` and writes notifications (`src/lib/notifications`).
  6. Action returns an `ActionResponse` and triggers any cache revalidation.

## Module reference (by folder)

- `src/app`
  - App Router pages, route handlers, layouts. Entry points: [src/app/layout.tsx](src/app/layout.tsx) and dashboard layout [src/app/(dashboard)/layout.tsx](src/app/(dashboard)/layout.tsx).

- `src/actions`
  - All feature use-cases. Each file follows the pattern: auth gate -> zod parsing -> DB transaction -> side-effects -> response. Examples: [src/actions/quotation-actions.ts](src/actions/quotation-actions.ts), [src/actions/project-actions.ts](src/actions/project-actions.ts).

- `src/lib`
  - `auth`: session lifecycle and guards (`src/lib/auth/session.ts`, `src/lib/auth/validate.ts`).
  - `db`: lazy Drizzle client and helpers (`src/lib/db/index.ts`, `src/lib/db/schema.ts`).
  - `finance`: double-entry ledger helpers (`src/lib/finance/ledger.ts`).
  - `pricing`: pure pricing calculations (`src/lib/pricing/engine.ts`).
  - `notifications`: write/broadcast helpers (`src/lib/notifications/broadcast.ts`).
  - `validators`: Zod schemas for domain inputs (`src/lib/validators`).

- `src/hooks`
  - TanStack Query wrappers and mutation factory: [src/hooks/mutation-factory.ts](src/hooks/mutation-factory.ts).

- `src/components` and `src/stores`
  - UI primitives, PDF templates, and Zustand stores (e.g. `src/stores/quote-builder-store.ts`).

## Database & migrations

- Schema canonical source: [src/lib/db/schema.ts](src/lib/db/schema.ts).
- Migrations: `drizzle/migrations` — each migration is a timestamped SQL file.
- Seeding utilities: [src/lib/db/seed.ts](src/lib/db/seed.ts), config in [src/lib/db/seed-config.ts](src/lib/db/seed-config.ts).

Best practices for DB changes
- Add Drizzle migrations for schema changes; commit SQL files.
- For new domain entities: add Zod validators, DB schema, server actions, and tests in that order.

## Local developer setup

Prerequisites
- Node.js v24+ (as declared by the project tooling).
- `pnpm` (the repo uses pnpm; `packageManager` is set in `package.json`).
- A Postgres-compatible database for `DATABASE_URL` (Neon recommended for parity with production).

Quick setup commands

1) Install dependencies

```bash
pnpm install
```

2) Create local env

```powershell
Copy-Item .\.env.example .\.env.local
```

3) Edit `.env.local` — minimum required keys
- `DATABASE_URL` — Postgres connection string used by Drizzle.
- `SESSION_SECRET` — must be set for session cookie sealing (see `src/lib/auth/session.ts`).
- `BLOB_READ_WRITE_TOKEN` — for upload endpoints when using Vercel Blob.

4) Run DB migrations

```bash
pnpm db:migrate
```

5) (Optional) Seed baseline data

```bash
pnpm db:seed
```

6) Start dev server

```bash
pnpm dev
```

Notes
- If you change schema files, run migrations and update seeds if necessary.
- Use `pnpm test:db` to run DB-heavy tests (see testing section).

## Testing and quality gates

- Test runner: Vitest. Config: [vitest.config.mts](vitest.config.mts).
- Typechecking: `pnpm typecheck`.
- Formatting/linting: `pnpm biome:check` and any repo formatting tasks aggregated under `pnpm green` scripts.

Useful scripts (from `package.json`)

```bash
pnpm typecheck
pnpm biome:check
pnpm test
pnpm test:db
pnpm green:code
```

`pnpm test:db` notes
- This script requires a test database configured in environment variables used by the DB test config. It pushes the schema and runs DB-integrated tests; use with caution when running against shared databases.

## Operational scripts

- Scripts live under [scripts](scripts) and are executed with `tsx`.
- Common helpers:
  - DB reset: [scripts/db-reset.ts](scripts/db-reset.ts)
  - DB handover reset/verify: [scripts/db-handover-reset.ts](scripts/db-handover-reset.ts), [scripts/db-handover-verify.ts](scripts/db-handover-verify.ts)

## Where to start reading (developer onboarding path)

1. `README.md` — high-level product flow and run instructions ([README.md](README.md)).
2. Auth internals: `src/lib/auth/session.ts`, `src/lib/auth/validate.ts` — learn session lifecycle and guards.
3. DB client and schema: `src/lib/db/index.ts`, `src/lib/db/schema.ts`.
4. One end-to-end use-case: `src/actions/quotation-actions.ts` → `src/lib/pricing/engine.ts` → `src/lib/finance/ledger.ts`.
5. Hooks + UI: `src/hooks/mutation-factory.ts` → `src/components` and `src/app` routes.

If you'd like, I can run a quick link-check to assert referenced files exist and optionally update any broken references.

---
Last updated: automated edit to improve clarity and workspace-relative links.
