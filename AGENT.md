# BOB Solar — Agent Command File

> **READ THIS FIRST.** This is your master instruction file.
> You are building a PWA for "BOB Solar", a solar installation company.
> Follow this file, then read SKILLS.md for patterns and RULES.md for constraints.

---

## 🎯 Your Mission

Build a production-ready, zero-cost Progressive Web App for BOB Solar — a small solar installation company in Myanmar. The app manages quotations, projects, inventory, customers, and warranty tracking for 3 users.

**This is NOT a generic admin dashboard.** It uses a unique "Solar Flow" design system with:
- Bottom dock navigation (like Spotify/macOS Dock) — NO left sidebar
- Spotify-inspired dark theme
- Solar-themed animations and visualizations
- Premium, futuristic green energy feel

---

## 📚 Required Reading (In Order)

Before writing ANY code, read these files in this exact order:

1. **`RULES.md`** — What you must never do and always do
2. **`SKILLS.md`** — Code patterns and technical examples for every technology
3. **`docs/00_implementation_plan.md`** — Architecture, schema, design system, tech decisions
4. **`docs/01_progress_log_foundation.md`** — Phase 1 tasks (start here)
5. **`docs/02_progress_log_core_features.md`** — Phase 2 tasks
6. **`docs/03_progress_log_projects_warranty.md`** — Phase 3 tasks
7. **`docs/04_progress_log_dashboard_notifications.md`** — Phase 4 tasks
8. **`docs/05_progress_log_final_deployment.md`** — Phase 5 tasks

---

## 🏗️ Build Order (STRICT — Do Not Skip Ahead)

### Phase 1: Foundation (MUST complete before Phase 2)
```
1.1 Project Scaffolding
    → Initialize Next.js 16 with Cloudflare Workers adapter
    → Configure TypeScript strict mode
    → Install ALL dependencies (see SKILLS.md for exact list)
    → Create folder structure

1.2 Design System — "Solar Flow"
    → Define CSS variables in globals.css (light + dark themes)
    → Set up typography (Outfit, Inter, JetBrains Mono)
    → Install and customize shadcn/ui components
    → Create Framer Motion animation presets

1.3 Database
    → Set up Drizzle ORM with Neon PostgreSQL
    → Define ALL tables in schema.ts (see ER diagram in plan)
    → Run migrations
    → Create seed data (3 users, sample inventory)

1.4 Authentication
    → Session management with Cloudflare KV
    → Login page with Solar Flow design
    → Middleware to protect (dashboard) routes
    → Logout functionality

1.5 App Shell
    → Root layout with providers (QueryClient, ThemeProvider, Toaster)
    → Dashboard layout with:
      - Top bar (logo, search trigger, notification bell, avatar, theme toggle)
      - Bottom dock navigation (5 items)
      - Command bar (⌘K)
    → Page transition animations

1.6 Theme Switching
    → Light/dark toggle with smooth transition
    → Persist preference in localStorage
    → No flash of wrong theme on load

1.7 PWA Setup
    → Serwist service worker
    → Web app manifest
    → PWA icons
```

### Phase 2: Core Features (MUST complete before Phase 3)
```
2.1 Inventory / Price & Stock Management
    → CRUD operations via Server Actions
    → Card grid with category filter pills
    → Inline editing (price, stock)
    → Search with debounce
    → Add/Edit dialog with form validation

2.2 Customer Management
    → CRUD operations
    → Customer list with search
    → Customer detail page with tabs (Overview, Quotes, Projects)
    → Add/Edit dialog

2.3 Quotation Management
    → Price calculation engine (pure function, integer math)
    → Quote number generator (QT-2026-XXXX)
    → Quote builder page (split-pane: editor + live preview)
      - Customer selector (searchable)
      - Add items from inventory (search-as-you-type)
      - Drag-to-reorder line items
      - Real-time total calculation
      - Discount % and Tax % inputs
    → Quote list page with status filter tabs
    → Quote detail/edit page
    → Status workflow (draft → sent → accepted/rejected)
    → PDF generation with company branding
```

### Phase 3: Projects & Warranty (MUST complete before Phase 4)
```
3.1 Active Projects
    → Convert accepted quotation → project
    → Project list with status filters
    → Project detail page with:
      - Horizontal timeline (phases)
      - Tabs: Overview, Costs, Remarks, Warranty
    → Add extra costs with budget tracking
    → Add remarks (note/issue/update)
    → Mark as completed

3.2 Completed Projects & Warranty
    → Completed projects history page
    → Warranty alert CRUD
    → Auto-create warranty alerts on project completion
    → Warranty page with filter/resolve workflow
    → Overdue alert highlighting

3.3 File Upload (R2)
    → Presigned URL generation
    → Upload component (drag-and-drop)
    → Company logo upload in settings
```

### Phase 4: Dashboard & Notifications (MUST complete before Phase 5)
```
4.1 Dashboard — "Energy Flow Canvas"
    → Solar orbit/radial metrics visualization
    → Energy flow pipeline diagram (customers → quotes → projects → completed)
    → Activity stream (last 10 actions)
    → Quick action cards
    → Upcoming alerts widget

4.2 Notification System
    → In-app notification creation (triggered by business events)
    → Notification bell with unread count badge
    → Notification panel (slide-in)
    → Mark as read / Mark all as read
    → Toast notifications for CRUD feedback

4.3 Settings Page
    → Company info form (name, address, phone, bank details)
    → Company logo upload
    → User management (3 users, admin only)
    → Preferences (theme, default tax %, warranty durations)
```

### Phase 5: Final Polish & Deployment
```
5.1 Error Handling
    → error.tsx for each route segment
    → not-found.tsx (custom 404)
    → Loading skeletons for all pages
    → Global error toast handling

5.2 Performance
    → Bundle analysis and optimization
    → Lazy loading heavy components
    → Image optimization
    → Lighthouse audit (target 90+)

5.3 CI/CD
    → GitHub Actions workflow (typecheck → lint → build → deploy)
    → Cloudflare Workers deployment
    → Environment secrets configuration

5.4 Production Verification
    → Full smoke test checklist
    → Cross-browser testing
    → Responsive testing at all breakpoints
```

---

## ⚙️ Key Context You Need

### This App Is
- A **gift** for a friend's company — not commercial
- Used by **3 people only** (1 admin, 2 staff)
- **Zero cost** — all free tiers (Neon 0.5GB, Cloudflare free plan)
- **MMK currency** (Myanmar Kyat) — integers only, no decimals
- **Single company** — no multi-tenant

### Design Philosophy: "Solar Flow"
- **NOT a generic admin dashboard** — avoid left sidebars, generic stat cards
- **Bottom dock navigation** — like Spotify mobile / macOS Dock
- **Command bar** (⌘K / Ctrl+K) — for power users, quick actions, search
- **Color palette:**
  - Solar Amber (#F59E0B) — primary accent
  - Energy Emerald (#10B981) — secondary accent
  - Flow Indigo (#6366F1) — tertiary accent
  - Dark mode base: #121212 (Spotify-style true dark)
- **Typography:** Outfit (headings), Inter (body), JetBrains Mono (numbers)
- **Animations:** Staggered fade-ups, orbital glow, count-up numbers, morphing status pills
- **Premium feel:** Glassmorphism cards in dark mode, gradient buttons, subtle shadows

### Database: Important Relationships
```
Customers → Quotations → Quotation Items ← Inventory Items
                ↓
            Projects → Project Costs ← Inventory Items
                     → Project Remarks
                     → Warranty Alerts
Users → Quotations (created_by)
     → Project Costs (added_by)
     → Project Remarks (author_id)
     → Notifications (user_id)
```

### Price Flow: Critical Business Logic
```
1. Admin sets base price in Inventory → inventory_items.unit_price
2. Quote Builder pulls current price → user can override per-line-item
3. On quote save → price SNAPSHOTS into quotation_items.unit_price
4. Future inventory price changes DO NOT affect existing quotes
5. Project costs are independent → can reference inventory or be ad-hoc
6. All calculations use integer math (MMK has no decimal units)
```

### Auto-Generated Numbers
```
Quotations: QT-{YEAR}-{0001..9999}  → QT-2026-0001
Projects:   PJ-{YEAR}-{0001..9999}  → PJ-2026-0001
Sequence resets each year.
```

### Status Workflows
```
Quotation: draft → sent → accepted → [convert to project]
                       → rejected → draft (reopen)
                       → expired

Project:   planning → in_progress → completed
                    → on_hold → in_progress
                    → cancelled
           completed → [auto-creates warranty alerts]
```

---

## 🔍 How to Check Your Work

After completing each phase, verify:

```bash
# Must all pass with zero errors
pnpm typecheck          # TypeScript strict mode check
pnpm lint               # ESLint check
pnpm build              # Production build with Turbopack

# Manual checks
- Open in browser and test all CRUD flows
- Toggle theme (light/dark) — verify all pages
- Test on mobile viewport (375px)
- Check loading states (skeleton UI)
- Check error states (force an error)
- Check empty states (no data)
```

---

## 📝 Progress Tracking

After completing each task, update the corresponding progress log file:
- Change `- [ ]` to `- [x]` for completed items
- Add any notes about deviations or decisions made

The progress logs are in:
```
docs/01_progress_log_foundation.md
docs/02_progress_log_core_features.md
docs/03_progress_log_projects_warranty.md
docs/04_progress_log_dashboard_notifications.md
docs/05_progress_log_final_deployment.md
```

---

## 🚨 Common Mistakes to Avoid

1. **Don't create a left sidebar** — Use bottom dock navigation
2. **Don't use npm** — Use pnpm exclusively
3. **Don't fetch data in client components** — Use Server Actions + TanStack Query
4. **Don't use D1** — D1 is SQLite. Use Neon PostgreSQL + Hyperdrive
5. **Don't use `any` type** — TypeScript strict mode is mandatory
6. **Don't skip Zod validation** — Validate in EVERY Server Action
7. **Don't hardcode colors** — Use CSS variables
8. **Don't modify shadcn/ui source files** — Customize via CSS variables only
9. **Don't use floating point for money** — MMK is integer-only
10. **Don't forget loading/error/empty states** — Every page needs all three

---

## 🎨 Design Reference: Key Screens

### Login Page
- Full-screen with animated gradient background (warm amber → soft orange)
- Centered glassmorphism card
- BOB Solar logo
- Email + password fields
- "Sign In" button with solar gradient
- Subtle sun ray animation in background

### Dashboard
- Greeting: "Good morning, {name}" (time-based)
- Solar orbit visualization (key metrics as orbiting planets)
- Energy flow pipeline (Sankey-style: customers → quotes → projects → done)
- Activity stream (timeline of recent actions)
- Quick action cards (glowing, glassmorphism)
- Upcoming alerts widget

### Quotation Builder
- Split-pane: left = editor (60%), right = live preview (40%)
- Customer search dropdown at top
- "Add Item" with inventory search
- Draggable line items with quantity/price inputs
- Real-time totals with discount/tax
- Mobile: stacked layout

### Bottom Dock Navigation
- Fixed at bottom of screen
- 5 items: Dashboard, Quotes, Projects, Inventory, Customers
- Active item: glowing solar amber indicator
- Smooth icon transitions
- Works on both mobile and desktop
