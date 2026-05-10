# BOB Solar

Production-oriented Progressive Web App (PWA) for BOB Solar, a solar installation company in Myanmar.

The system manages customers, quotations, projects, inventory, warranty alerts, and operational notifications in one workflow-first dashboard.

## Highlights

- Solar-focused workflow: customer → quotation → project → warranty
- Strict TypeScript and Zod-validated Server Actions
- Mobile-first dock navigation and keyboard command bar
- In-app notifications + toast feedback
- PDF quotation export with company branding
- PWA support via Serwist

## Tech Stack

- Framework: Next.js 16 (App Router), React 19
- Language: TypeScript (strict mode)
- Styling/UI: Tailwind CSS, shadcn/ui, Framer Motion
- Data: Drizzle ORM + Neon PostgreSQL
- Client state/data fetching: TanStack Query
- Storage: Vercel Blob
- Validation: Zod
- PWA: Serwist

## Prerequisites

- Node.js 22+
- pnpm 11+
- Neon PostgreSQL database

## Quick Start

1. Install dependencies

```bash
pnpm install
```

2. Create local environment file

```bash
cp .env.example .env.local
```

3. Run database schema sync/migrations

```bash
pnpm drizzle-kit push
```

4. Seed baseline data

```bash
pnpm db:seed
```

5. Start development server

```bash
pnpm dev
```

## Environment Variables

All required variables are documented in [.env.example](./.env.example):

- `DATABASE_URL`
- `BLOB_READ_WRITE_TOKEN`
- `SESSION_SECRET`

## Useful Commands

```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm test
```

## Deployment (Vercel)

This project is configured for Vercel using [vercel.json](./vercel.json):

- Install command: `pnpm install --frozen-lockfile`
- Build command: `pnpm typecheck && pnpm lint && pnpm build`

### Deploy Steps

1. Import repository into Vercel.
2. Add required environment variables in Vercel Project Settings.
3. Trigger deploy from `main`.
4. Verify authentication, database connectivity, and Blob uploads in production.

## Project Structure

```text
src/
  app/           # Next.js routes, layouts, API handlers
  actions/       # Server Actions
  components/    # UI + feature components
  hooks/         # TanStack Query hooks
  lib/           # auth, db, validators, utilities
docs/            # implementation plan and progress logs
drizzle/         # SQL migrations
public/          # static assets and PWA icons
```

## Quality & Standards

- Strict TypeScript configuration (no implicit `any`)
- Centralized error handling for Server Actions and query/mutation failures
- Accessible semantics (landmarks, labels, skip-link, icon button labels)
- Performance-aware defaults (query caching strategy, dynamic loading for heavy dashboard widgets)
