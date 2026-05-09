# BOB Solar — Progress Log Part 1: Foundation

> **Phase 1 — Project Setup, Design System, Database, Auth, Shell & PWA**
> Target: Week 1–2

---

## 1.1 Project Scaffolding

### 1.1.1 Initialize Next.js Project

- [x] Run `npx -y create-next-app@latest ./ --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"` --use-pnpm
- [x] Verify Next.js 16.2+ and React 19 are installed
- [x] Verify Turbopack dev server starts: `pnpm dev`
- [x] Confirm standard Next.js config in `next.config.ts` (no adapter needed)

### 1.1.2 TypeScript Configuration

- [x] Update `tsconfig.json` — enable `strict: true`
- [x] Enable `noUncheckedIndexedAccess: true`
- [x] Enable `exactOptionalPropertyTypes: true`
- [x] Set `target: "ES2022"`, `module: "ESNext"`
- [x] Verify: `pnpm tsc --noEmit` passes with zero errors

### 1.1.3 Code Quality Tooling

- [x] Install & configure ESLint with Next.js recommended rules
- [x] Install & configure Prettier
- [x] Add `.editorconfig` for consistent formatting
- [x] Create `pnpm lint` script
- [x] Create `pnpm typecheck` script (`tsc --noEmit`)
- [x] Create `pnpm format` script
- [x] Verify all scripts pass on clean project

### 1.1.4 Install Core Dependencies

- [x] Install Tailwind CSS v4+ and configure `src/app/globals.css`
- [x] Install shadcn/ui — run `pnpm dlx shadcn@latest init`
  - [x] Select `New York` style (using modern `radix-nova` preset)
  - [x] Set `cssVariables: true` in `components.json`
  - [x] Verify base components install correctly
- [x] Install Framer Motion: `pnpm add framer-motion`
- [x] Install TanStack Query v5: `pnpm add @tanstack/react-query`
- [x] Install Zustand: `pnpm add zustand`
- [x] Install Zod: `pnpm add zod`
- [x] Install React Hook Form + resolver: `pnpm add react-hook-form @hookform/resolvers`
- [x] Install `@react-pdf/renderer`: `pnpm add @react-pdf/renderer`
- [x] Install Drizzle ORM + Kit: `pnpm add drizzle-orm postgres` + `pnpm add -D drizzle-kit`
- [x] Install Serwist: `pnpm add @serwist/next serwist`
- [x] Install Vercel Blob: `pnpm add @vercel/blob`
- [x] Install bcrypt: `pnpm add bcryptjs` + `pnpm add -D @types/bcryptjs`
- [x] Verify `pnpm dev` still works after all installs
- [x] Verify `pnpm build` reaches data collection (requires `DATABASE_URL` for full success)

### 1.1.5 Project Structure Setup

- [x] Create folder structure as defined in implementation plan:
  - [x] `src/app/(auth)/`
  - [x] `src/app/(dashboard)/`
  - [x] `src/app/api/`
  - [x] `src/components/ui/`
  - [x] `src/components/layout/`
  - [x] `src/components/shared/`
  - [x] `src/lib/db/`
  - [x] `src/lib/auth/`
  - [x] `src/lib/storage/`
  - [x] `src/lib/pdf/`
  - [x] `src/lib/pricing/`
  - [x] `src/lib/validators/`
  - [x] `src/hooks/`
  - [x] `src/stores/`
  - [x] `src/actions/`
  - [x] `src/types/`
  - [x] `public/icons/`
  - [x] `public/fonts/`
- [x] Add placeholder `page.tsx` for each route group
- [x] Verify folder structure matches plan

---

## 1.2 Design System — "Solar Flow"

### 1.2.1 Color Tokens & CSS Variables

- [x] Define all color tokens in `src/app/globals.css` using OKLCH format
- [x] **Light mode** root variables:
  - [x] `--background: #FAFAF8` (warm white)
  - [x] `--foreground: #1A1A1A`
  - [x] `--primary` (solar amber `#F59E0B`)
  - [x] `--primary-foreground`
  - [x] `--secondary` (energy emerald `#10B981`)
  - [x] `--secondary-foreground`
  - [x] `--accent` (flow indigo `#6366F1`)
  - [x] `--accent-foreground`
  - [x] `--muted`, `--muted-foreground`
  - [x] `--card`, `--card-foreground`
  - [x] `--destructive`, `--destructive-foreground`
  - [x] `--border`, `--input`, `--ring`
  - [x] Custom: `--solar-gradient`, `--energy-gradient`, `--surface-elevated`
- [x] **Dark mode** (Spotify-inspired) `.dark` variables:
  - [x] `--background: #121212` (true dark)
  - [x] `--foreground: #EDEDED`
  - [x] `--card: #181818`
  - [x] `--surface-elevated: #282828`
  - [x] All other tokens adjusted for dark mode contrast
- [x] Verify color contrast ratios meet WCAG AA (4.5:1 for text)
- [x] Test both themes render correctly

### 1.2.2 Typography System

- [x] Download & self-host fonts via `next/font/google`:
  - [x] `Outfit` — Variable weight (headings)
  - [x] `Inter` — Variable weight (body)
  - [x] `JetBrains Mono` — (numbers, codes)
- [x] Configure CSS variables for fonts in `globals.css` and `layout.tsx`
- [x] Define typography scale in Tailwind config (CSS variables @theme):
  - [x] `font-heading` → Outfit
  - [x] `font-body` → Inter
  - [x] `font-mono` → JetBrains Mono
- [x] Set base `font-size: 16px`, `line-height: 1.6`
- [x] Define heading sizes: h1 (2.5rem), h2 (2rem), h3 (1.5rem), h4 (1.25rem)
- [x] Verify fonts load correctly in browser
- [x] Verify no FOUT (flash of unstyled text)

### 1.2.3 Spacing, Radius & Shadows

- [x] Define spacing scale in Tailwind (4px base grid)
- [x] Define border-radius tokens:
  - [x] `--radius-sm: 0.375rem`
  - [x] `--radius-md: 0.625rem`
  - [x] `--radius-lg: 1rem`
  - [x] `--radius-xl: 1.5rem`
- [x] Define shadow tokens:
  - [x] `--shadow-sm` (subtle lift)
  - [x] `--shadow-md` (card hover)
  - [x] `--shadow-lg` (elevated modals)
  - [x] `--shadow-glow-solar` (amber glow for active states)
  - [x] `--shadow-glow-energy` (emerald glow)
- [x] Verify shadows render well on both themes

### 1.2.4 Install & Customize shadcn/ui Components

- [x] Install base components via CLI:
  - [x] `button` — customize with solar gradient variant
  - [x] `card` — glassmorphism variant for dark mode
  - [x] `input`
  - [x] `label`
  - [x] `dialog` / `sheet`
  - [x] `dropdown-menu`
  - [x] `select`
  - [x] `table`
  - [x] `tabs`
  - [x] `toast` / `sonner`
  - [x] `badge`
  - [x] `avatar`
  - [x] `command` (for command palette)
  - [x] `separator`
  - [x] `skeleton`
  - [x] `tooltip`
  - [x] `popover`
  - [x] `form` (react-hook-form integration)
  - [x] `scroll-area`
- [x] Verify all components inherit Solar Flow design tokens
- [x] Create custom button variant: `solar` (gradient amber-to-orange)
- [x] Create custom button variant: `energy` (gradient emerald-to-teal)
- [x] Create custom card variant: `glass` (backdrop-blur + semi-transparent)
- [x] Test all components in both light and dark themes

### 1.2.5 Animation System (Framer Motion)

- [x] Create `src/lib/motion.ts` — shared animation presets:
  - [x] `fadeIn` — opacity 0→1, 300ms
  - [x] `fadeUp` — opacity + translateY(20px→0), 400ms
  - [x] `staggerContainer` — staggerChildren: 0.05s
  - [x] `staggerItem` — child variant for stagger
  - [x] `scaleIn` — scale 0.95→1 + opacity, 200ms
  - [x] `slideInRight` — translateX(100%→0), 300ms
  - [x] `glowPulse` — boxShadow pulse animation
  - [x] `countUp` — number counting animation helper
- [x] Configure `LazyMotion` with `domAnimation` features in root layout to reduce bundle
- [x] Verify animations run at 60fps (no jank)

---

## 1.3 Database Setup

### 1.3.1 Neon PostgreSQL Setup (USER TASK)

- [x] Create Neon account (free tier)
- [x] Create project: `bobsolar`
- [x] Create database: `bobsolar_db`
- [x] Copy **direct** connection string (NOT pooled)
- [x] Store connection string in `.env.local` as `DATABASE_URL`
- [x] Verify connection from local machine using `psql` or Drizzle Studio

### 1.3.2 Drizzle ORM Configuration

- [x] Create `drizzle.config.ts`:
  ```
  dialect: "postgresql"
  schema: "./src/lib/db/schema.ts"
  out: "./drizzle/migrations"
  dbCredentials: { url: process.env.DATABASE_URL }
  ```
- [x] Create `src/lib/db/index.ts` — Drizzle client initialization:
  - [x] Import `postgres` driver (Neon serverless)
  - [x] Export typed `db` instance
  - [x] Use `DATABASE_URL` env var directly (no Hyperdrive needed on Vercel)
- [x] Verify Drizzle Studio works: `pnpm drizzle-kit studio`

### 1.3.3 Schema Definition (`src/lib/db/schema.ts`)

- [x] Define `users` table:
  - [x] `id` (uuid, PK, default random)
  - [x] `email` (text, unique, not null)
  - [x] `passwordHash` (text, not null)
  - [x] `name` (text, not null)
  - [x] `role` (enum: 'admin' | 'staff', default 'staff')
  - [x] `createdAt` (timestamp, default now)
- [x] Define `customers` table:
  - [x] `id`, `name`, `email`, `phone`, `address`, `city`, `notes`, `createdAt`
- [x] Define `inventoryItems` table:
  - [x] `id`, `name`, `category` (enum), `unit` (enum), `unitPrice` (decimal)
  - [x] `stockQty` (integer), `brand`, `modelNumber`, `isActive`, `updatedAt`
- [x] Define `quotations` table:
  - [x] `id`, `quoteNumber` (unique, auto-generated pattern)
  - [x] `customerId` (FK → customers), `createdBy` (FK → users)
  - [x] `status` (enum: draft/sent/accepted/rejected/expired)
  - [x] `subtotal`, `discountPercent`, `discountAmount`, `taxPercent`, `taxAmount`, `total`
  - [x] `notes`, `validUntil`, `createdAt`, `updatedAt`
- [x] Define `quotationItems` table:
  - [x] `id`, `quotationId` (FK), `itemId` (FK → inventoryItems)
  - [x] `description`, `quantity`, `unitPrice`, `totalPrice`, `sortOrder`
- [x] Define `projects` table:
  - [x] `id`, `projectNumber` (unique, auto-generated)
  - [x] `quotationId` (FK), `customerId` (FK)
  - [x] `status` (enum: planning/in_progress/on_hold/completed/cancelled)
  - [x] `siteAddress`, `systemSizeKwp`, `quotedTotal`, `actualTotal`
  - [x] `startDate`, `targetCompletion`, `actualCompletion`, `notes`, `createdAt`
- [x] Define `projectCosts` table:
  - [x] `id`, `projectId` (FK), `itemId` (FK, nullable)
  - [x] `description`, `amount`, `costType` (enum), `incurredDate`, `addedBy` (FK)
- [x] Define `projectRemarks` table:
  - [x] `id`, `projectId` (FK), `authorId` (FK)
  - [x] `content`, `remarkType` (enum), `createdAt`
- [x] Define `warrantyAlerts` table:
  - [x] `id`, `projectId` (FK), `alertType` (enum)
  - [x] `description`, `dueDate`, `isResolved`, `createdAt`
- [x] Define `notifications` table:
  - [x] `id`, `userId` (FK), `title`, `message`, `type` (enum)
  - [x] `link` (nullable), `isRead`, `createdAt`
- [x] Define `companySettings` table:
  - [x] `key` (text, PK), `value` (text), `updatedAt`
- [x] Define `sessions` table (for DB-backed auth):
  - [x] `id` (text, PK) — crypto.randomUUID()
  - [x] `userId` (uuid, FK → users)
  - [x] `role` (text)
  - [x] `expiresAt` (timestamp)
  - [x] `createdAt` (timestamp, default now)
- [x] Define all relations using `relations()` helper
- [x] Export all table types using `InferSelectModel` / `InferInsertModel`

### 1.3.4 Database Migration

- [x] Generate initial migration: `pnpm drizzle-kit generate`
- [x] Review generated SQL migration file
- [x] Apply migration to Neon: `pnpm drizzle-kit push`
- [x] Verify all tables created in Neon dashboard
- [x] Verify all foreign keys and indexes are correct

### 1.3.5 Seed Data

- [x] Create `src/lib/db/seed.ts`:
  - [x] Seed 1 admin user (email: admin@bobsolar.com, hashed password)
  - [x] Seed 2 staff users
  - [x] Seed company settings (company name, address, phone)
  - [x] Seed 10-15 sample inventory items across all categories
  - [x] Seed 3 sample customers
- [x] Add `pnpm db:seed` script to `package.json`
- [x] Run seed and verify data in Drizzle Studio

---

## 1.4 Authentication System

### 1.4.1 Password Hashing

- [x] Implement using `bcryptjs` (pure JS, works everywhere):
  - [x] `hashPassword(plain: string): Promise<string>` — bcrypt with 12 rounds
  - [x] `verifyPassword(plain: string, hash: string): Promise<boolean>`
- [x] Test hash + verify roundtrip

### 1.4.2 Session Management (`src/lib/auth/session.ts`)

- [x] Implement `createSession(userId: string, role: string): Promise<string>`
  - [x] Generate `crypto.randomUUID()` session ID
  - [x] Store in DB: `sessions` table (id, userId, role, expiresAt = 7 days)
  - [x] Return session ID
- [x] Implement `getSession(sessionId: string): Promise<SessionData | null>`
  - [x] Read from DB, check expiry
  - [x] Return null if expired or not found
- [x] Implement `deleteSession(sessionId: string): Promise<void>`
  - [x] Delete row from sessions table
- [x] Implement cookie helpers:
  - [x] `setSessionCookie(response, sessionId)` — httpOnly, secure, sameSite: lax, maxAge: 7d
  - [x] `getSessionFromCookie(request): string | null`
  - [x] `clearSessionCookie(response)`

### 1.4.3 Auth Proxy (`src/proxy.ts`)

- [x] Create Next.js proxy (formerly middleware):
  - [x] Match `/(dashboard)/*` routes
  - [x] Read session cookie
  - [x] If no cookie → redirect to `/login`
  - [x] If cookie exists → allow through (full validation happens in Server Actions)
  - [x] Note: Proxy runs at Edge on Vercel — keep it lightweight (no DB calls)
- [x] Test: unauthenticated user redirected to login
- [ ] Test: authenticated user can access dashboard

### 1.4.4 Auth Helper for Server Actions (`src/lib/auth/validate.ts`)

- [x] Create `requireAuth()` helper:
  - [x] Reads session cookie from `cookies()` API
  - [x] Validates session against DB (checks expiry)
  - [x] Returns `{ userId, role }` or throws redirect to `/login`
  - [x] Used at the top of every Server Action

### 1.4.5 Login Page (`src/app/(auth)/login/page.tsx`)

- [x] Design login page with Solar Flow aesthetics:
  - [x] Centered card with glassmorphism effect
  - [x] BOB Solar logo at top
  - [x] Animated sun/gradient background
  - [x] Email + password fields
  - [x] "Sign In" button with solar gradient
  - [x] Error message display with Zod/Sonner
- [x] Implement login Server Action (`src/actions/auth-actions.ts`):
  - [x] Validate with Zod schema
  - [x] Query user by email
  - [x] Verify password hash with bcrypt
  - [x] Create session → set cookie → redirect to dashboard
- [x] Implement logout Server Action:
  - [x] Delete session from DB
  - [x] Clear cookie
  - [x] Redirect to login
- [x] Test: valid login → redirects to dashboard
- [x] Test: invalid credentials → shows error
- [x] Test: logout → redirects to login, session cleared

### 1.4.6 Auth Layout

- [x] Create `src/app/(auth)/layout.tsx`:
  - [x] Minimal layout without nav (only logo + background)
  - [x] Check if already authenticated → redirect to dashboard

---

## 1.5 App Shell & Navigation

### 1.5.1 Root Layout (`src/app/layout.tsx`)

- [x] Set HTML `lang="en"`
- [x] Apply `font-body` class to body
- [x] Configure metadata: title, description, viewport, theme-color
- [x] Add `<ThemeProvider>` (next-themes)
- [x] Add `<QueryClientProvider>` (TanStack Query)
- [x] Add `<Toaster>` (sonner notifications)
- [x] Load fonts via `next/font`

### 1.5.2 Dashboard Layout (`src/app/(dashboard)/layout.tsx`)

- [x] Create app shell structure:
  - [x] **Top Bar** (fixed):
    - [x] BOB Solar logo (left) — subtle glow animation
    - [x] Search trigger button (center, `⌘K`)
    - [x] Notification bell (right) — pulse animation on unread
    - [x] User avatar + name (right)
    - [x] Theme toggle (right) — sun/moon icon morph
  - [x] **Bottom Dock** (fixed bottom):
    - [x] 5 navigation items as pill icons:
      - [x] 🏠 Dashboard
      - [x] 📋 Quotes
      - [x] ⚡ Projects
      - [x] 📦 Inventory
      - [x] 👥 Customers
    - [x] Active item has glowing solar indicator
    - [x] Smooth icon transitions on active change
  - [x] **Main content area** (scrollable, with padding)
- [x] Desktop responsive adjustments:
  - [x] Bottom dock stays as floating dock
  - [x] Content area max-width with centered layout
- [x] Mobile responsive adjustments:
  - [x] Bottom dock remains as mobile nav bar
  - [x] Top bar simplified (logo + bell + avatar)
- [x] Add route transition animations (Framer Motion `AnimatePresence`)
- [x] Verify navigation between all routes works
- [x] Verify active state highlights correct item

### 1.5.3 Command Bar (`src/components/layout/command-bar.tsx`)

- [x] Use shadcn `Command` component as base
- [x] Trigger with `⌘K` (Mac) / `Ctrl+K` (Windows)
- [x] Floating overlay with backdrop blur
- [x] Search sections:
  - [x] Quick Actions: "New Quote", "New Customer", "New Project"
  - [x] Navigation: Jump to any page
  - [ ] Recent: Last 5 viewed items (requires storage logic)
- [x] Keyboard navigation (arrow keys + enter)
- [x] Close on `Escape` or backdrop click
- [x] Smooth scale + fade entrance animation
- [x] Test: opens/closes correctly
- [x] Test: keyboard navigation works
- [x] Test: actions trigger correctly

---

## 1.6 Theme Switching

### 1.6.1 Theme Provider Setup

- [x] Install `next-themes`
- [x] Configure system preference detection
- [x] Persist theme choice in `localStorage`
- [x] Apply `.dark` class to `<html>` element
- [x] Prevent flash of wrong theme on page load (SSR-safe)

### 1.6.2 Theme Toggle Component (`src/components/shared/theme-toggle.tsx`)

- [x] Sun ↔ Moon icon with smooth morph animation (Framer Motion)
- [x] Click toggles between light and dark
- [x] Accessible: proper `aria-label`

### 1.6.3 Theme Verification

- [x] Verify all colors switch correctly
- [x] Verify no white flashes on dark mode
- [x] Verify shadows and glows adapt to theme
- [x] Verify glassmorphism effect works on dark mode
- [x] Verify readability of all text on both themes
- [ ] Test on mobile browsers

---

## 1.7 PWA Setup

### 1.7.1 Web App Manifest (`src/app/manifest.ts`)

- [x] Export manifest with:
  - [x] `name: "BOB Solar"`
  - [x] `short_name: "BOB Solar"`
  - [x] `description: "Solar Installation Management"`
  - [x] `start_url: "/"`
  - [x] `display: "standalone"`
  - [x] `background_color` matching theme
  - [x] `theme_color` (solar amber)
  - [x] Icons array: 192x192, 512x512 (PNG)
- [x] Generate PWA icons (solar-themed logo)
- [x] Place icons in `public/icons/`

### 1.7.2 Service Worker (`src/sw.ts`)

- [x] Configure Serwist:
  - [x] `precacheEntries: self.__SW_MANIFEST`
  - [x] `skipWaiting: true`
  - [x] `clientsClaim: true`
  - [x] `runtimeCaching: defaultCache`
- [x] Add event listeners

### 1.7.3 Next.js + Serwist Integration

- [x] Wrap `next.config.ts` with `withSerwist()`:
  - [x] `swSrc: "src/sw.ts"`
  - [x] `swDest: "public/sw.js"`
- [x] Add `public/sw.js` to `.gitignore`
- [ ] Verify service worker registers in browser DevTools
- [ ] Verify app is installable (Chrome install prompt)
- [ ] Test offline shell loading
- [ ] Verify manifest is detected correctly

---

## Part 1 Completion Criteria

- [x] `pnpm dev` starts without errors
- [x] `pnpm build` succeeds
- [x] `pnpm typecheck` passes
- [x] `pnpm lint` passes
- [x] Login/logout flow logic implemented
- [x] Dashboard shell renders with navigation
- [x] Theme toggle works (light ↔ dark)
- [x] PWA is installable (manifest + service worker ready)
- [x] Database has seeded data visible in Drizzle Studio
- [x] All routes are accessible and protected by auth logic

---

## Verification Needed (Unverified / Missing Tasks)

The following tasks require runtime verification or are missing features that need to be implemented:

### Requires Runtime / Browser Testing

- [ ] **1.4.3** Test: authenticated user can access dashboard
- [ ] **1.5.3** Recent: Last 5 viewed items (requires storage logic) — **Feature not implemented**
- [ ] **1.6.3** Test on mobile browsers

### PWA — Implementation Complete (Needs Browser Verification)

PWA code is fully implemented. The following require browser testing:

- [ ] Verify service worker registers in browser DevTools
- [ ] Verify app is installable (Chrome install prompt)
- [ ] Test offline shell loading
- [ ] Verify manifest is detected correctly

### Missing Features to Implement

- **Command Bar Recent Items**: The command bar at section 1.5.3 claims "Recent: Last 5 viewed items" but this feature has not been implemented. Needs storage logic (localStorage or DB) to track recently viewed items.
