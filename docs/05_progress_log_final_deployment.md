# BOB Solar — Progress Log Part 5: Final Check & Deployment

> **Phase 5 — Production Hardening, Testing, CI/CD & Deployment**
> Target: Week 10

---

## 5.1 Error Handling & Resilience

### 5.1.1 Error Boundaries
- [ ] Create `src/app/error.tsx` — root error boundary
  - [ ] Solar-themed error illustration
  - [ ] "Something went wrong" message
  - [ ] "Try Again" button (calls `reset()`)
  - [ ] "Go to Dashboard" link
- [ ] Create `src/app/(dashboard)/error.tsx` — dashboard-specific
- [ ] Create `src/app/not-found.tsx` — custom 404 page
  - [ ] Solar-themed "Page not found" illustration
  - [ ] "Back to Dashboard" button
- [ ] Create per-feature error boundaries:
  - [ ] `src/app/(dashboard)/quotations/error.tsx`
  - [ ] `src/app/(dashboard)/projects/error.tsx`
  - [ ] `src/app/(dashboard)/inventory/error.tsx`
  - [ ] `src/app/(dashboard)/customers/error.tsx`
- [ ] Test: force an error → verify boundary catches it
- [ ] Test: "Try Again" button recovers correctly

### 5.1.2 Loading States
- [ ] Create `src/app/(dashboard)/loading.tsx` — dashboard skeleton
- [ ] Create per-page loading states:
  - [ ] `src/app/(dashboard)/quotations/loading.tsx` — skeleton card list
  - [ ] `src/app/(dashboard)/projects/loading.tsx` — skeleton card list
  - [ ] `src/app/(dashboard)/inventory/loading.tsx` — skeleton grid
  - [ ] `src/app/(dashboard)/customers/loading.tsx` — skeleton card list
  - [ ] `src/app/(dashboard)/warranty/loading.tsx` — skeleton list
- [ ] Skeleton component (`src/components/shared/skeleton-card.tsx`):
  - [ ] Matches actual card layout shape
  - [ ] Shimmer animation (gradient sweep)
  - [ ] Solar-themed shimmer color (subtle amber tint)
- [ ] Verify: no layout shift between skeleton and loaded content (CLS = 0)

### 5.1.3 Global Error Handling
- [ ] Create TanStack Query error handler:
  - [ ] Default `onError`: show error toast
  - [ ] Network error: show "Connection lost" toast with retry button
  - [ ] 401 error: redirect to login (session expired)
  - [ ] 500 error: show generic error toast
- [ ] Server Action error wrapper utility:
  - [ ] Standardized error response format: `{ success: false, error: string }`
  - [ ] Standardized success response: `{ success: true, data: T }`
- [ ] Test: network disconnect → error toast appears
- [ ] Test: expired session → redirects to login

---

## 5.2 SEO & Metadata

### 5.2.1 Root Metadata (`src/app/layout.tsx`)
- [ ] Title template: `%s | BOB Solar`
- [ ] Default title: `BOB Solar — Solar Installation Management`
- [ ] Description: `Professional solar installation management for BOB Solar`
- [ ] Viewport: `width=device-width, initial-scale=1`
- [ ] Theme color: solar amber
- [ ] Icons: reference PWA icons

### 5.2.2 Per-Page Metadata
- [ ] Dashboard: `title: "Dashboard"`
- [ ] Quotations: `title: "Quotations"`
- [ ] Projects: `title: "Projects"`
- [ ] Inventory: `title: "Inventory & Pricing"`
- [ ] Customers: `title: "Customers"`
- [ ] Warranty: `title: "Warranty & Aftersales"`
- [ ] Settings: `title: "Settings"`
- [ ] Login: `title: "Sign In"`

### 5.2.3 Semantic HTML Audit
- [ ] Each page has exactly one `<h1>`
- [ ] Proper heading hierarchy (h1 → h2 → h3)
- [ ] Interactive elements have unique `id` attributes
- [ ] All images have `alt` text
- [ ] All buttons/links have accessible labels
- [ ] Form inputs have associated `<label>` elements
- [ ] Navigation landmarks: `<nav>`, `<main>`, `<header>`
- [ ] Skip-to-content link for keyboard users

---

## 5.3 Performance Optimization

### 5.3.1 Bundle Analysis
- [ ] Run bundle analyzer: `ANALYZE=true pnpm build`
- [ ] Identify large dependencies:
  - [ ] Framer Motion: verify tree-shaking, use `LazyMotion`
  - [ ] @react-pdf/renderer: ensure only loaded on PDF routes
  - [ ] TanStack Query: verify no unnecessary imports
- [ ] Code splitting verification:
  - [ ] Each route group loads independently
  - [ ] Heavy components use `next/dynamic` with `{ ssr: false }`
  - [ ] PDF components NOT included in main bundle

### 5.3.2 Image Optimization
- [ ] All static images use `next/image` with proper sizing
- [ ] PWA icons optimized (PNG, compressed)
- [ ] Company logo: served from Vercel Blob with appropriate caching headers
- [ ] Lazy load images below the fold

### 5.3.3 Caching Strategy
- [ ] TanStack Query stale times reviewed:
  - [ ] Dashboard stats: 60s
  - [ ] Lists (quotes, projects, customers): 30s
  - [ ] Inventory: 5min
  - [ ] Single item details: 30s
  - [ ] Notifications: 15s (with 30s refetch interval)
- [ ] Next.js caching:
  - [ ] Static pages use ISR where applicable
  - [ ] API routes set appropriate `Cache-Control` headers
  - [ ] `use cache` directive for appropriate Server Components

### 5.3.4 Core Web Vitals Targets
- [ ] **LCP** (Largest Contentful Paint): < 2.5s
  - [ ] Verify: dashboard loads within target
  - [ ] Optimize: prioritize above-fold content
- [ ] **FID/INP** (Interaction to Next Paint): < 200ms
  - [ ] Verify: button clicks respond immediately
  - [ ] Optimize: avoid blocking main thread
- [ ] **CLS** (Cumulative Layout Shift): < 0.1
  - [ ] Verify: no layout shifts on page load
  - [ ] Optimize: skeleton dimensions match content

### 5.3.5 Lighthouse Audit
- [ ] Run Lighthouse on all key pages:
  - [ ] Login page: target 95+ all categories
  - [ ] Dashboard: target 90+ all categories
  - [ ] Quotation list: target 90+ all categories
  - [ ] Quote builder: target 85+ (complex interactive page)
- [ ] Fix any issues scoring below targets
- [ ] Re-run until all targets met

---

## 5.4 Responsive Testing

### 5.4.1 Breakpoint Testing
- [ ] **Mobile (375px — iPhone SE):**
  - [ ] Bottom nav visible and functional
  - [ ] All content readable without horizontal scroll
  - [ ] Dialogs become bottom sheets
  - [ ] Quote builder: single column stacked layout
  - [ ] Dashboard: single column grid
  - [ ] Tables: horizontal scroll where needed
- [ ] **Tablet (768px — iPad):**
  - [ ] 2-column grids where appropriate
  - [ ] Navigation adapts correctly
  - [ ] Dashboard: 2-column grid
- [ ] **Desktop (1024px+):**
  - [ ] Full layout with all features visible
  - [ ] Max-width container (1400px) centered
  - [ ] Quote builder: split pane layout
  - [ ] Dashboard: 3-column grid
- [ ] **Large Desktop (1440px+):**
  - [ ] Content doesn't stretch too wide
  - [ ] Comfortable reading width maintained

### 5.4.2 Touch Interaction Testing
- [ ] All tap targets ≥ 44x44px on mobile
- [ ] Swipe gestures don't conflict with navigation
- [ ] Drag-and-drop works on touch devices (quote builder)
- [ ] Long press doesn't interfere with normal taps

---

## 5.5 CI/CD Pipeline

### 5.5.1 GitHub Repository Setup
- [ ] Initialize git: `git init`
- [ ] Create `.gitignore`:
  - [ ] `node_modules/`, `.next/`, `.vercel/`, `.env.local`, `public/sw.js`
  - [ ] `drizzle/migrations/*.sql` (track in git for reproducibility)
- [ ] Create GitHub repository: `bobsolar` (private)
- [ ] Push initial commit
- [ ] Set up branch protection on `main` (optional for 3 users)

### 5.5.2 Vercel Project Setup
- [ ] Sign up for Vercel (Hobby plan — free, non-commercial)
- [ ] Import GitHub repository in Vercel dashboard
- [ ] Framework auto-detected as Next.js
- [ ] Set build command: `pnpm typecheck && pnpm lint && pnpm build`
- [ ] Set install command: `pnpm install --frozen-lockfile`
- [ ] Configure environment variables:
  - [ ] `DATABASE_URL` — Neon connection string
  - [ ] `BLOB_READ_WRITE_TOKEN` — Vercel Blob access token
  - [ ] `SESSION_SECRET` — for cookie signing (generate random 64-char string)
- [ ] Deploy: push to `main` → automatic deployment
- [ ] Verify deployment URL is accessible

### 5.5.3 Preview Deployments (Automatic)
- [ ] Vercel auto-creates preview URLs for every PR
- [ ] Verify: create a test PR → preview URL generated
- [ ] Preview uses same environment variables (or set separate preview env vars)

### 5.5.4 Optional: vercel.json
- [ ] Create `vercel.json` (only if custom config needed):
  ```json
  {
    "buildCommand": "pnpm typecheck && pnpm lint && pnpm build",
    "installCommand": "pnpm install --frozen-lockfile"
  }
  ```

---

## 5.6 Vercel Production Setup

### 5.6.1 Vercel Configuration
- [ ] **Vercel Blob:**
  - [ ] Create Blob store in Vercel dashboard
  - [ ] Copy `BLOB_READ_WRITE_TOKEN` to environment variables
  - [ ] Verify blob upload works from deployed app
- [ ] **Environment Variables:**
  - [ ] `DATABASE_URL` — Neon production connection string
  - [ ] `BLOB_READ_WRITE_TOKEN` — Vercel Blob token
  - [ ] `SESSION_SECRET` — cookie signing secret

### 5.6.2 Custom Domain (Optional)
- [ ] If using custom domain (e.g., `app.bobsolar.com`):
  - [ ] Add domain in Vercel dashboard
  - [ ] Update DNS records (CNAME to `cname.vercel-dns.com`)
  - [ ] SSL is automatic
- [ ] If no custom domain: use `bobsolar.vercel.app`

### 5.6.3 Database Migration (Production)
- [ ] Run Drizzle migrations against production Neon DB:
  - [ ] `pnpm drizzle-kit push` (or `drizzle-kit migrate`)
- [ ] Verify all tables created
- [ ] Run seed script for production:
  - [ ] Create admin user
  - [ ] Set initial company settings
  - [ ] Seed initial inventory items

### 5.6.4 First Deployment
- [ ] Push to `main` — Vercel auto-builds and deploys
- [ ] Verify deployment URL is accessible
- [ ] Verify login works
- [ ] Verify all pages load
- [ ] Verify database operations work
- [ ] Verify sessions work (login persists across refreshes)
- [ ] Verify Blob upload works

---

## 5.7 Post-Deployment Verification Checklist

### 5.7.1 Functional Smoke Test
- [ ] **Auth:**
  - [ ] Login with admin credentials ✓
  - [ ] Navigate all pages as authenticated user ✓
  - [ ] Logout and verify redirect to login ✓
  - [ ] Attempt access without login → redirected ✓
- [ ] **Inventory:**
  - [ ] Create new item ✓
  - [ ] Edit item price inline ✓
  - [ ] Filter by category ✓
  - [ ] Search items ✓
- [ ] **Customers:**
  - [ ] Create customer ✓
  - [ ] View customer detail ✓
  - [ ] Edit customer ✓
  - [ ] Search customers ✓
- [ ] **Quotations:**
  - [ ] Create new quotation with line items ✓
  - [ ] Verify calculations are correct ✓
  - [ ] Save as draft ✓
  - [ ] Send quotation ✓
  - [ ] Download PDF → verify formatting ✓
  - [ ] Accept quotation ✓
  - [ ] Duplicate quotation ✓
- [ ] **Projects:**
  - [ ] Convert accepted quote to project ✓
  - [ ] Add extra cost ✓
  - [ ] Add remark ✓
  - [ ] Update project status ✓
  - [ ] Mark as completed ✓
  - [ ] Verify warranty alerts auto-created ✓
- [ ] **Warranty:**
  - [ ] View warranty alerts ✓
  - [ ] Resolve alert ✓
  - [ ] Filter by status ✓
- [ ] **Dashboard:**
  - [ ] All metrics display correctly ✓
  - [ ] Visualizations animate ✓
  - [ ] Recent activity shows real data ✓
  - [ ] Quick actions work ✓
- [ ] **Notifications:**
  - [ ] Notification bell shows unread count ✓
  - [ ] Panel opens with notification list ✓
  - [ ] Mark as read works ✓
- [ ] **Settings:**
  - [ ] Company info saves correctly ✓
  - [ ] Logo uploads and appears in PDF ✓
  - [ ] Theme toggle persists ✓
- [ ] **PWA:**
  - [ ] App installable on Chrome ✓
  - [ ] App opens from home screen ✓
  - [ ] Offline shell loads ✓

### 5.7.2 Cross-Browser Testing
- [ ] Chrome (latest) — all features ✓
- [ ] Firefox (latest) — all features ✓
- [ ] Safari (latest) — all features ✓
- [ ] Mobile Chrome (Android) — responsive ✓
- [ ] Mobile Safari (iOS) — responsive ✓

### 5.7.3 Performance Verification (Production)
- [ ] Lighthouse scores on production URL:
  - [ ] Performance: ≥ 90
  - [ ] Accessibility: ≥ 95
  - [ ] Best Practices: ≥ 95
  - [ ] SEO: ≥ 90
  - [ ] PWA: ≥ 90
- [ ] First page load: < 3s on 3G connection
- [ ] Subsequent navigation: < 500ms
- [ ] No memory leaks after 10 min usage

---

## 5.8 Documentation

### 5.8.1 README.md
- [ ] Project overview
- [ ] Tech stack summary
- [ ] Getting started (dev setup):
  - [ ] Prerequisites (Node 22+, pnpm)
  - [ ] Clone, install, env setup
  - [ ] Database setup (Neon)
  - [ ] Run dev server
- [ ] Environment variables reference
- [ ] Deployment instructions
- [ ] Folder structure overview

### 5.8.2 .env.example
- [ ] Create with all required environment variables (values blank)
- [ ] Comments explaining each variable

---

## 🎉 Project Complete Criteria

> All of the following must be true to consider the project complete:

- [ ] All Phase 1-5 completion criteria from Parts 1-4 are met
- [ ] Zero TypeScript errors (`pnpm typecheck`)
- [ ] Zero ESLint errors (`pnpm lint`)
- [ ] Production build succeeds (`pnpm build`)
- [ ] Deployed to Vercel and accessible
- [ ] All functional smoke tests pass
- [ ] Lighthouse scores meet targets
- [ ] PWA installable and functional
- [ ] PDF generation produces professional documents
- [ ] Theme switching (light/dark) works correctly
- [ ] All pages responsive across mobile/tablet/desktop
- [ ] README documentation complete
- [ ] Git repository clean with meaningful commit history
- [ ] **Zero monthly cost** infrastructure verified (Vercel Hobby + Neon free) ✅
