# BOB Solar — Progress Log Part 1: Foundation

> **Phase 1 — Project Setup, Design System, Database, Auth, Shell & PWA**
> Target: Week 1–2

---

## 1.1 Project Scaffolding

### 1.1.1 Initialize Next.js Project
- [ ] Run `npx -y create-cloudflare@latest -- bobsolar --framework=next --platform=workers`
- [ ] Verify Next.js 16.2+ and React 19 are installed
- [ ] Switch to `pnpm` — delete `node_modules` + `package-lock.json`, run `pnpm install`
- [ ] Verify Turbopack dev server starts: `pnpm dev`
- [ ] Confirm `@opennextjs/cloudflare` adapter is configured in `next.config.ts`

### 1.1.2 TypeScript Configuration
- [ ] Update `tsconfig.json` — enable `strict: true`
- [ ] Enable `noUncheckedIndexedAccess: true`
- [ ] Enable `exactOptionalPropertyTypes: true`
- [ ] Set `target: "ES2022"`, `module: "ESNext"`
- [ ] Verify: `pnpm tsc --noEmit` passes with zero errors

### 1.1.3 Code Quality Tooling
- [ ] Install & configure ESLint with Next.js recommended rules
- [ ] Install & configure Prettier
- [ ] Add `.editorconfig` for consistent formatting
- [ ] Create `pnpm lint` script
- [ ] Create `pnpm typecheck` script (`tsc --noEmit`)
- [ ] Create `pnpm format` script
- [ ] Verify all scripts pass on clean project

### 1.1.4 Install Core Dependencies
- [ ] Install Tailwind CSS v4+ and configure `tailwind.config.ts`
- [ ] Install shadcn/ui — run `pnpm dlx shadcn@latest init`
  - [ ] Select `New York` style
  - [ ] Set `cssVariables: true` in `components.json`
  - [ ] Verify base components install correctly
- [ ] Install Framer Motion: `pnpm add framer-motion`
- [ ] Install TanStack Query v5: `pnpm add @tanstack/react-query`
- [ ] Install Zustand: `pnpm add zustand`
- [ ] Install Zod: `pnpm add zod`
- [ ] Install React Hook Form + resolver: `pnpm add react-hook-form @hookform/resolvers`
- [ ] Install `@react-pdf/renderer`: `pnpm add @react-pdf/renderer`
- [ ] Install Drizzle ORM + Kit: `pnpm add drizzle-orm postgres` + `pnpm add -D drizzle-kit`
- [ ] Install Serwist: `pnpm add @serwist/next serwist`
- [ ] Verify `pnpm dev` still works after all installs
- [ ] Verify `pnpm build` succeeds

### 1.1.5 Project Structure Setup
- [ ] Create folder structure as defined in implementation plan:
  - [ ] `src/app/(auth)/`
  - [ ] `src/app/(dashboard)/`
  - [ ] `src/app/api/`
  - [ ] `src/components/ui/`
  - [ ] `src/components/layout/`
  - [ ] `src/components/shared/`
  - [ ] `src/lib/db/`
  - [ ] `src/lib/auth/`
  - [ ] `src/lib/storage/`
  - [ ] `src/lib/pdf/`
  - [ ] `src/lib/pricing/`
  - [ ] `src/lib/validators/`
  - [ ] `src/hooks/`
  - [ ] `src/stores/`
  - [ ] `src/actions/`
  - [ ] `src/types/`
  - [ ] `public/icons/`
  - [ ] `public/fonts/`
- [ ] Add placeholder `page.tsx` for each route group
- [ ] Verify folder structure matches plan

---

## 1.2 Design System — "Solar Flow"

### 1.2.1 Color Tokens & CSS Variables
- [ ] Define all color tokens in `src/app/globals.css` using OKLCH format
- [ ] **Light mode** root variables:
  - [ ] `--background: #FAFAF8` (warm white)
  - [ ] `--foreground: #1A1A1A`
  - [ ] `--primary` (solar amber `#F59E0B`)
  - [ ] `--primary-foreground`
  - [ ] `--secondary` (energy emerald `#10B981`)
  - [ ] `--secondary-foreground`
  - [ ] `--accent` (flow indigo `#6366F1`)
  - [ ] `--accent-foreground`
  - [ ] `--muted`, `--muted-foreground`
  - [ ] `--card`, `--card-foreground`
  - [ ] `--destructive`, `--destructive-foreground`
  - [ ] `--border`, `--input`, `--ring`
  - [ ] Custom: `--solar-gradient`, `--energy-gradient`, `--surface-elevated`
- [ ] **Dark mode** (Spotify-inspired) `.dark` variables:
  - [ ] `--background: #121212` (true dark)
  - [ ] `--foreground: #EDEDED`
  - [ ] `--card: #181818`
  - [ ] `--surface-elevated: #282828`
  - [ ] All other tokens adjusted for dark mode contrast
- [ ] Verify color contrast ratios meet WCAG AA (4.5:1 for text)
- [ ] Test both themes render correctly

### 1.2.2 Typography System
- [ ] Download & self-host fonts in `public/fonts/`:
  - [ ] `Outfit` — Variable weight (headings)
  - [ ] `Inter` — Variable weight (body)
  - [ ] `JetBrains Mono` — (numbers, codes)
- [ ] Configure `@font-face` declarations in `globals.css`
- [ ] Define typography scale in Tailwind config:
  - [ ] `font-heading` → Outfit
  - [ ] `font-body` → Inter
  - [ ] `font-mono` → JetBrains Mono
- [ ] Set base `font-size: 16px`, `line-height: 1.6`
- [ ] Define heading sizes: h1 (2.5rem), h2 (2rem), h3 (1.5rem), h4 (1.25rem)
- [ ] Verify fonts load correctly in browser
- [ ] Verify no FOUT (flash of unstyled text)

### 1.2.3 Spacing, Radius & Shadows
- [ ] Define spacing scale in Tailwind (4px base grid)
- [ ] Define border-radius tokens:
  - [ ] `--radius-sm: 0.375rem`
  - [ ] `--radius-md: 0.625rem`
  - [ ] `--radius-lg: 1rem`
  - [ ] `--radius-xl: 1.5rem`
  - [ ] `--radius-full: 9999px`
- [ ] Define shadow tokens:
  - [ ] `--shadow-sm` (subtle lift)
  - [ ] `--shadow-md` (card hover)
  - [ ] `--shadow-lg` (elevated modals)
  - [ ] `--shadow-glow-solar` (amber glow for active states)
  - [ ] `--shadow-glow-energy` (emerald glow)
- [ ] Verify shadows render well on both themes

### 1.2.4 Install & Customize shadcn/ui Components
- [ ] Install base components via CLI:
  - [ ] `button` — customize with solar gradient variant
  - [ ] `card` — glassmorphism variant for dark mode
  - [ ] `input`
  - [ ] `label`
  - [ ] `dialog` / `sheet`
  - [ ] `dropdown-menu`
  - [ ] `select`
  - [ ] `table`
  - [ ] `tabs`
  - [ ] `toast` / `sonner`
  - [ ] `badge`
  - [ ] `avatar`
  - [ ] `command` (for command palette)
  - [ ] `separator`
  - [ ] `skeleton`
  - [ ] `tooltip`
  - [ ] `popover`
  - [ ] `form` (react-hook-form integration)
  - [ ] `scroll-area`
- [ ] Verify all components inherit Solar Flow design tokens
- [ ] Create custom button variant: `solar` (gradient amber-to-orange)
- [ ] Create custom button variant: `energy` (gradient emerald-to-teal)
- [ ] Create custom card variant: `glass` (backdrop-blur + semi-transparent)
- [ ] Test all components in both light and dark themes

### 1.2.5 Animation System (Framer Motion)
- [ ] Create `src/lib/motion.ts` — shared animation presets:
  - [ ] `fadeIn` — opacity 0→1, 300ms
  - [ ] `fadeUp` — opacity + translateY(20px→0), 400ms
  - [ ] `staggerContainer` — staggerChildren: 0.05s
  - [ ] `staggerItem` — child variant for stagger
  - [ ] `scaleIn` — scale 0.95→1 + opacity, 200ms
  - [ ] `slideInRight` — translateX(100%→0), 300ms
  - [ ] `glowPulse` — boxShadow pulse animation
  - [ ] `countUp` — number counting animation helper
- [ ] Configure `LazyMotion` with `domAnimation` features in root layout to reduce bundle
- [ ] Verify animations run at 60fps (no jank)

---

## 1.3 Database Setup

### 1.3.1 Neon PostgreSQL Setup
- [ ] Create Neon account (free tier)
- [ ] Create project: `bobsolar`
- [ ] Create database: `bobsolar_db`
- [ ] Copy **direct** connection string (NOT pooled)
- [ ] Store connection string in `.env.local` as `DATABASE_URL`
- [ ] Verify connection from local machine using `psql` or Drizzle Studio

### 1.3.2 Drizzle ORM Configuration
- [ ] Create `drizzle.config.ts`:
  ```
  dialect: "postgresql"
  schema: "./src/lib/db/schema.ts"
  out: "./drizzle/migrations"
  dbCredentials: { url: process.env.DATABASE_URL }
  ```
- [ ] Create `src/lib/db/index.ts` — Drizzle client initialization:
  - [ ] Import `postgres` driver
  - [ ] Export typed `db` instance
  - [ ] Handle Hyperdrive connection string for production vs direct for dev
- [ ] Verify Drizzle Studio works: `pnpm drizzle-kit studio`

### 1.3.3 Schema Definition (`src/lib/db/schema.ts`)
- [ ] Define `users` table:
  - [ ] `id` (uuid, PK, default random)
  - [ ] `email` (text, unique, not null)
  - [ ] `passwordHash` (text, not null)
  - [ ] `name` (text, not null)
  - [ ] `role` (enum: 'admin' | 'staff', default 'staff')
  - [ ] `createdAt` (timestamp, default now)
- [ ] Define `customers` table:
  - [ ] `id`, `name`, `email`, `phone`, `address`, `city`, `notes`, `createdAt`
- [ ] Define `inventoryItems` table:
  - [ ] `id`, `name`, `category` (enum), `unit` (enum), `unitPrice` (decimal)
  - [ ] `stockQty` (integer), `brand`, `modelNumber`, `isActive`, `updatedAt`
- [ ] Define `quotations` table:
  - [ ] `id`, `quoteNumber` (unique, auto-generated pattern)
  - [ ] `customerId` (FK → customers), `createdBy` (FK → users)
  - [ ] `status` (enum: draft/sent/accepted/rejected/expired)
  - [ ] `subtotal`, `discountPercent`, `discountAmount`, `taxPercent`, `taxAmount`, `total`
  - [ ] `notes`, `validUntil`, `createdAt`, `updatedAt`
- [ ] Define `quotationItems` table:
  - [ ] `id`, `quotationId` (FK), `itemId` (FK → inventoryItems)
  - [ ] `description`, `quantity`, `unitPrice`, `totalPrice`, `sortOrder`
- [ ] Define `projects` table:
  - [ ] `id`, `projectNumber` (unique, auto-generated)
  - [ ] `quotationId` (FK), `customerId` (FK)
  - [ ] `status` (enum: planning/in_progress/on_hold/completed/cancelled)
  - [ ] `siteAddress`, `systemSizeKwp`, `quotedTotal`, `actualTotal`
  - [ ] `startDate`, `targetCompletion`, `actualCompletion`, `notes`, `createdAt`
- [ ] Define `projectCosts` table:
  - [ ] `id`, `projectId` (FK), `itemId` (FK, nullable)
  - [ ] `description`, `amount`, `costType` (enum), `incurredDate`, `addedBy` (FK)
- [ ] Define `projectRemarks` table:
  - [ ] `id`, `projectId` (FK), `authorId` (FK)
  - [ ] `content`, `remarkType` (enum), `createdAt`
- [ ] Define `warrantyAlerts` table:
  - [ ] `id`, `projectId` (FK), `alertType` (enum)
  - [ ] `description`, `dueDate`, `isResolved`, `createdAt`
- [ ] Define `notifications` table:
  - [ ] `id`, `userId` (FK), `title`, `message`, `type` (enum)
  - [ ] `link` (nullable), `isRead`, `createdAt`
- [ ] Define `companySettings` table:
  - [ ] `key` (text, PK), `value` (text), `updatedAt`
- [ ] Define all relations using `relations()` helper
- [ ] Export all table types using `InferSelectModel` / `InferInsertModel`

### 1.3.4 Database Migration
- [ ] Generate initial migration: `pnpm drizzle-kit generate`
- [ ] Review generated SQL migration file
- [ ] Apply migration to Neon: `pnpm drizzle-kit push`
- [ ] Verify all tables created in Neon dashboard
- [ ] Verify all foreign keys and indexes are correct

### 1.3.5 Seed Data
- [ ] Create `src/lib/db/seed.ts`:
  - [ ] Seed 1 admin user (email: admin@bobsolar.com, hashed password)
  - [ ] Seed 2 staff users
  - [ ] Seed company settings (company name, address, phone, logo placeholder)
  - [ ] Seed 10-15 sample inventory items across all categories
  - [ ] Seed 3 sample customers
- [ ] Add `pnpm db:seed` script to `package.json`
- [ ] Run seed and verify data in Drizzle Studio

---

## 1.4 Authentication System

### 1.4.1 Cloudflare KV Setup
- [ ] Create KV namespace in Cloudflare dashboard: `BOBSOLAR_SESSIONS`
- [ ] Add binding to `wrangler.jsonc`: `SESSION_KV`
- [ ] For local dev: configure `wrangler` KV emulation
- [ ] Verify KV read/write works locally

### 1.4.2 Password Hashing
- [ ] Choose hashing approach compatible with Workers runtime
- [ ] Implement `hashPassword(plain: string): Promise<string>`
- [ ] Implement `verifyPassword(plain: string, hash: string): Promise<boolean>`
- [ ] Test hash + verify roundtrip

### 1.4.3 Session Management (`src/lib/auth/session.ts`)
- [ ] Implement `createSession(userId: string, role: string): Promise<string>`
  - [ ] Generate `crypto.randomUUID()` session ID
  - [ ] Store in KV: key = `session:{id}`, value = `{userId, role, createdAt}`
  - [ ] Set TTL = 7 days (604800 seconds)
  - [ ] Return session ID
- [ ] Implement `getSession(sessionId: string): Promise<SessionData | null>`
  - [ ] Read from KV, parse JSON, validate
- [ ] Implement `deleteSession(sessionId: string): Promise<void>`
  - [ ] Delete key from KV
- [ ] Implement cookie helpers:
  - [ ] `setSessionCookie(response, sessionId)` — httpOnly, secure, sameSite: lax, maxAge: 7d
  - [ ] `getSessionFromCookie(request): string | null`
  - [ ] `clearSessionCookie(response)`

### 1.4.4 Auth Middleware (`src/lib/auth/middleware.ts`)
- [ ] Create Next.js middleware (`src/middleware.ts`):
  - [ ] Match `/(dashboard)/*` routes
  - [ ] Read session cookie
  - [ ] Validate against KV
  - [ ] If invalid → redirect to `/login`
  - [ ] If valid → pass `userId` and `role` in request headers
- [ ] Test: unauthenticated user redirected to login
- [ ] Test: authenticated user can access dashboard
- [ ] Test: expired session redirected to login

### 1.4.5 Login Page (`src/app/(auth)/login/page.tsx`)
- [ ] Design login page with Solar Flow aesthetics:
  - [ ] Centered card with glassmorphism effect
  - [ ] BOB Solar logo at top
  - [ ] Animated sun/gradient background
  - [ ] Email + password fields
  - [ ] "Sign In" button with solar gradient
  - [ ] Error message display with shake animation
- [ ] Implement login Server Action (`src/actions/auth-actions.ts`):
  - [ ] Validate with Zod schema
  - [ ] Query user by email
  - [ ] Verify password hash
  - [ ] Create session → set cookie → redirect to dashboard
- [ ] Implement logout Server Action:
  - [ ] Delete session from KV
  - [ ] Clear cookie
  - [ ] Redirect to login
- [ ] Test: valid login → redirects to dashboard
- [ ] Test: invalid credentials → shows error
- [ ] Test: logout → redirects to login, session cleared

### 1.4.6 Auth Layout
- [ ] Create `src/app/(auth)/layout.tsx`:
  - [ ] Minimal layout without nav (only logo + background)
  - [ ] Check if already authenticated → redirect to dashboard

---

## 1.5 App Shell & Navigation

### 1.5.1 Root Layout (`src/app/layout.tsx`)
- [ ] Set HTML `lang="en"`
- [ ] Apply `font-body` class to body
- [ ] Configure metadata: title, description, viewport, theme-color
- [ ] Add `<ThemeProvider>` (next-themes or custom)
- [ ] Add `<QueryClientProvider>` (TanStack Query)
- [ ] Add `<Toaster>` (sonner notifications)
- [ ] Load fonts via `next/font` or `@font-face`

### 1.5.2 Dashboard Layout (`src/app/(dashboard)/layout.tsx`)
- [ ] Create app shell structure:
  - [ ] **Top Bar** (fixed):
    - [ ] BOB Solar logo (left) — subtle glow animation
    - [ ] Search trigger button (center, `⌘K`)
    - [ ] Notification bell (right) — pulse animation on unread
    - [ ] User avatar + name (right)
    - [ ] Theme toggle (right) — sun/moon icon morph
  - [ ] **Bottom Dock** (fixed bottom):
    - [ ] 5 navigation items as pill icons:
      - [ ] 🏠 Dashboard
      - [ ] 📋 Quotes
      - [ ] ⚡ Projects
      - [ ] 📦 Inventory
      - [ ] 👥 Customers
    - [ ] Active item has glowing solar indicator
    - [ ] Smooth icon transitions on active change
  - [ ] **Main content area** (scrollable, with padding)
- [ ] Desktop responsive adjustments:
  - [ ] Bottom dock transforms to horizontal top-sub-nav or stays as floating dock
  - [ ] Content area max-width with centered layout
- [ ] Mobile responsive adjustments:
  - [ ] Bottom dock remains as mobile nav bar
  - [ ] Top bar simplified (logo + bell + avatar)
- [ ] Add route transition animations (Framer Motion `AnimatePresence`)
- [ ] Verify navigation between all routes works
- [ ] Verify active state highlights correct item

### 1.5.3 Command Bar (`src/components/layout/command-bar.tsx`)
- [ ] Use shadcn `Command` component as base
- [ ] Trigger with `⌘K` (Mac) / `Ctrl+K` (Windows)
- [ ] Floating overlay with backdrop blur
- [ ] Search sections:
  - [ ] Quick Actions: "New Quote", "New Customer", "New Project"
  - [ ] Navigation: Jump to any page
  - [ ] Recent: Last 5 viewed items
- [ ] Keyboard navigation (arrow keys + enter)
- [ ] Close on `Escape` or backdrop click
- [ ] Smooth scale + fade entrance animation
- [ ] Test: opens/closes correctly
- [ ] Test: keyboard navigation works
- [ ] Test: actions trigger correctly

---

## 1.6 Theme Switching

### 1.6.1 Theme Provider Setup
- [ ] Install `next-themes` or implement custom provider
- [ ] Configure system preference detection
- [ ] Persist theme choice in `localStorage`
- [ ] Apply `.dark` class to `<html>` element
- [ ] Prevent flash of wrong theme on page load (SSR-safe)

### 1.6.2 Theme Toggle Component (`src/components/shared/theme-toggle.tsx`)
- [ ] Sun ↔ Moon icon with smooth morph animation (Framer Motion)
- [ ] Click toggles between light and dark
- [ ] Tooltip showing current mode
- [ ] Accessible: proper `aria-label`

### 1.6.3 Theme Verification
- [ ] Verify all colors switch correctly
- [ ] Verify no white flashes on dark mode
- [ ] Verify shadows and glows adapt to theme
- [ ] Verify glassmorphism effect works on dark mode
- [ ] Verify readability of all text on both themes
- [ ] Test on mobile browsers

---

## 1.7 PWA Setup

### 1.7.1 Web App Manifest (`src/app/manifest.ts`)
- [ ] Export manifest with:
  - [ ] `name: "BOB Solar"`
  - [ ] `short_name: "BOB Solar"`
  - [ ] `description: "Solar Installation Management"`
  - [ ] `start_url: "/"`
  - [ ] `display: "standalone"`
  - [ ] `background_color` matching theme
  - [ ] `theme_color` (solar amber)
  - [ ] Icons array: 192x192, 512x512 (PNG)
- [ ] Generate PWA icons (solar-themed logo)
- [ ] Place icons in `public/icons/`

### 1.7.2 Service Worker (`src/sw.ts`)
- [ ] Configure Serwist:
  - [ ] `precacheEntries: self.__SW_MANIFEST`
  - [ ] `skipWaiting: true`
  - [ ] `clientsClaim: true`
  - [ ] `runtimeCaching: defaultCache`
- [ ] Add event listeners

### 1.7.3 Next.js + Serwist Integration
- [ ] Wrap `next.config.ts` with `withSerwist()`:
  - [ ] `swSrc: "src/sw.ts"`
  - [ ] `swDest: "public/sw.js"`
- [ ] Add `public/sw.js` to `.gitignore`
- [ ] Verify service worker registers in browser DevTools
- [ ] Verify app is installable (Chrome install prompt)
- [ ] Test offline shell loading
- [ ] Verify manifest is detected correctly

---

## 1.8 Wrangler Configuration

### 1.8.1 Configure `wrangler.jsonc`
- [ ] Set `name: "bobsolar"`
- [ ] Set `compatibility_date: "2026-05-01"`
- [ ] Set `compatibility_flags: ["nodejs_compat"]`
- [ ] Add KV namespace binding: `SESSION_KV`
- [ ] Add R2 bucket binding: `FILE_STORAGE`
- [ ] Add Hyperdrive binding: `HYPERDRIVE`
- [ ] Set environment variables for production

### 1.8.2 Local Development Verification
- [ ] Run `pnpm dev` — app starts without errors
- [ ] Run `wrangler dev` — app starts with Cloudflare bindings
- [ ] Verify KV operations work locally
- [ ] Verify database connection works locally
- [ ] Verify R2 operations work locally (or mock)

---

## Part 1 Completion Criteria
- [ ] `pnpm dev` starts without errors
- [ ] `pnpm build` succeeds
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] Login/logout flow works end-to-end
- [ ] Dashboard shell renders with navigation
- [ ] Theme toggle works (light ↔ dark)
- [ ] PWA is installable
- [ ] Database has seeded data visible in Drizzle Studio
- [ ] All routes are accessible and protected by auth
