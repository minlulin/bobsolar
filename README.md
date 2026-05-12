# ☀️ BOB Solar — Premium Operations Engine

<div align="center">
  <p><strong>A high-performance, beautiful Progressive Web Application built for boutique solar installation management.</strong></p>
  <p>Engineered for instantaneous hydration, absolute network parallelization, and zero-latency operational control.</p>
</div>

<p align="center">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16.2+-black?style=flat-square&logo=next.js" />
  <img alt="React" src="https://img.shields.io/badge/React-19-149ECA?style=flat-square&logo=react&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-6.0_Strict-3178C6?style=flat-square&logo=typescript&logoColor=white" />
  <img alt="Neon" src="https://img.shields.io/badge/Database-Neon_PostgreSQL-00E699?style=flat-square" />
  <img alt="Drizzle" src="https://img.shields.io/badge/ORM-Drizzle-C5F74F?style=flat-square" />
  <img alt="PWA" src="https://img.shields.io/badge/PWA-Serwist-7C3AED?style=flat-square" />
</p>

---

## ✨ System Architecture

BOB Solar uses a highly decoupled **Server Component + Client Island** hybrid architecture built on top of Next.js App Router and serverless edge tools:

```mermaid
graph LR
    A[Next.js App UI Shell] -->|PWA Edge Handshake| B[Vercel Server Runtime]
    B -->|Drizzle WS Caching| C[(Neon Serverless DB)]
    B -->|Streaming Pipeline| D[Vercel Blob Storage]
```

### Strategic Objectives

- **Zero Layout Shifts (CLS)**: Initial shells render purely on the server, forwarding pre-fetched static state directly into interactive hydration boundaries.
- **Concurrent DB Execution**: Independent dashboard aggregates and heavy table-scan workflows fire concurrently via array-mapped `Promise.all` resolution loops.
- **Dynamic Lazy Boundaries**: PDF rendering cores (`@react-pdf/renderer`) and dense analytical chart sheets remain dynamically separated (`next/dynamic`) until directly requested by the client.

---

## 🧭 The "Solar Flow" Operational Sequence

```
[ Customers ] ──► [ Inventory Matrix ] ──► [ Quotation Engine ] ──► [ Executable Projects ] ──► [ Warranty Care ]
```

1. **Client & Leads Registration**: Managed with structured PostgreSQL state histories tracking active deployment addresses.
2. **Canonical Price Matrix**: Live price ledgers managed with auto-caching validation locks (`INVENTORY_ITEMS.unit_price`).
3. **Quotation dossier Generation**: Fully interactive line-item builders capturing immutable pricing snapshots (`QUOTATION_ITEMS.unit_price`) supporting custom discount calculations, Myanmar Kyat (MMK) rounding logic, and custom layout streaming to branded PDF downloads.
4. **Active Project Commissioning**: Live cost tracking tracking itemized labor, logistics, and material disbursements against projected limits, publishing real-time budget overruns automatically.
5. **Aftersales Warranty Cadence**: Long-term tracking triggers signaling automated component follow-ups, system inversions, and hardware warranty alerts.

---

## 🚀 Quick Start Guide

### 1. Requirements & Setup

Ensure you have `pnpm` v11+ and Node.js v20+ configured locally.

```bash
# Clone and install locked dependencies
pnpm install
```

### 2. Environment Variables

Clone the runtime mapping template:

```bash
cp .env.example .env.local
```

Configure local environment keys within `.env.local`:

- `DATABASE_URL`: Connection string to your primary Neon Serverless instance.
- `TEST_DATABASE_URL`: Dedicated branch string for end-to-end integration verifications.
- `SESSION_SECRET`: 32-character secure secret string signing `httpOnly` auth cookies.
- `BLOB_READ_WRITE_TOKEN`: Vercel Blob API key enabling logo asset streaming.

### 3. Database Sync & Baseline Data

Provision your database schema definitions and inject standard configurations:

```bash
# Push Drizzle schema index updates to the remote instance
pnpm db:migrate

# Seed basic inventory items and default settings
pnpm db:seed
```

### 4. Local Development Server

Start the client server environment:

```bash
pnpm dev
```

Navigate to `http://localhost:3000` to interact with the application.

---

## ✅ Continuous Integration Quality Gates

Before pushing changes to production branches, run our internal automated check sequence:

```bash
# Execute pure static AST analysis: typechecking, linting, formatting, code logic
pnpm green:code

# Execute test schema validation and database workflow integration suites
pnpm green:db

# Run full standalone verification pipeline: code + db + production client builds
pnpm green
```

Detailed technical guide for local automation targets: [`docs/quality_scripts.md`](docs/quality_scripts.md).

---

## 📁 Repository Map

```text
bobsolar/
├── src/
│   ├── app/           # Hybrid Server Components & Route API Handlers
│   ├── actions/       # Server Actions handling secure transactional logic
│   ├── components/    # Reusable "Solar Flow" interface components & islands
│   ├── hooks/         # Typed TanStack Query data synchronization wrappers
│   ├── lib/           # Core configuration helpers: auth, db, pricing, validators
│   └── stores/        # Zustand global interface settings stores
├── docs/              # System architecture, design documentation, workflows
├── drizzle/           # Serialized SQL schema migrations
└── public/            # Standalone static media and PWA launcher icons
```

---

## 📜 Legal & Usage

Private proprietary operations portal built exclusively for **BOB Solar** internal workflows. All rights reserved.
