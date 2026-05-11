# ☀️ BOB Solar

<p align="center">
  <strong>Production-ready Progressive Web App for a solar installation business in Myanmar</strong><br/>
  Workflow-first operations: customers → quotations → projects → warranty
</p>

<p align="center">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" />
  <img alt="React" src="https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript&logoColor=white" />
  <img alt="Database" src="https://img.shields.io/badge/Database-Neon%20PostgreSQL-00E699" />
  <img alt="ORM" src="https://img.shields.io/badge/ORM-Drizzle-C5F74F" />
  <img alt="PWA" src="https://img.shields.io/badge/PWA-Serwist-7C3AED" />
</p>

---

## ✨ Overview

BOB Solar centralizes daily solar-business operations in one app:

- Customer management
- Quotation lifecycle with pricing snapshots
- Project tracking and completion workflow
- Warranty alerts and operational notifications
- Mobile-friendly PWA experience

Designed for a small team (3 users) with zero-cost infrastructure strategy.

---

## 🧭 Core Features

- **Solar Flow workflow**: customer → quotation → project → warranty
- **Server Actions + Zod validation** for secure and typed business operations
- **Strict TypeScript** with strong schema-driven modeling
- **Bottom dock navigation** and fast command-style UX
- **PDF quotation support** with branded output
- **In-app notifications** and toast feedback

---

## 🛠 Tech Stack

- **Framework**: Next.js 16 (App Router), React 19
- **Language**: TypeScript (strict mode)
- **UI/Styling**: Tailwind CSS, shadcn/ui, Framer Motion
- **Data**: Drizzle ORM + Neon PostgreSQL
- **Client Data Layer**: TanStack Query
- **Storage**: Vercel Blob
- **Validation**: Zod
- **PWA**: Serwist

---

## 🚀 Quick Start

### 1) Install dependencies

```bash
pnpm install
```

### 2) Configure environment

```bash
cp .env.example .env.local
```

Set required values in `.env.local`, including:

- `DATABASE_URL`
- `TEST_DATABASE_URL`
- `SESSION_SECRET`
- `BLOB_READ_WRITE_TOKEN`

### 3) Run migrations

```bash
pnpm db:migrate
```

### 4) Seed baseline data

```bash
pnpm db:seed
```

### 5) Start dev server

```bash
pnpm dev
```

---

## ✅ Quality Gates

Use these commands before deployment:

```bash
pnpm green:code   # typecheck + lint + format + non-DB tests
pnpm green:db     # test DB migration + DB integration tests
pnpm green        # full local CI gate: code + db + build
```

Detailed script usage: [`docs/quality_scripts.md`](docs/quality_scripts.md)

---

## 🧪 Testing

- `pnpm test` runs all test suites
- `pnpm test:code` runs non-DB suites
- `pnpm test:db` runs DB integration suites

DB tests are designed for `TEST_DATABASE_URL` (separate Neon test branch).

---

## 📦 Deployment (Vercel)

Project is configured for Vercel via `vercel.json`.

Recommended release sequence:

1. Pass `pnpm green`
2. Push to `main`
3. Deploy on Vercel
4. Verify auth, database, notifications, and file upload flows

---

## 📁 Project Structure

```text
src/
  app/           # Next.js routes, layouts, API handlers
  actions/       # Server Actions
  components/    # UI and feature components
  hooks/         # TanStack Query hooks
  lib/           # auth, db, validators, utilities
docs/            # implementation plans, progress logs, quality docs
drizzle/         # SQL migrations
public/          # static assets and PWA icons
```

---

## 📜 License

Private project for BOB Solar operations.
