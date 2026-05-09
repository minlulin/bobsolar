# BOB Solar — Project Rules

> **Strict rules that MUST be followed when writing code for this project.**
> Violating any of these rules is considered a bug.

---

## 🔴 CRITICAL RULES (Never Break)

### R1: TypeScript Strict Mode
- TypeScript strict mode is ON. Never use `any` type.
- Never use `@ts-ignore` or `@ts-expect-error`.
- Never use `as` type assertions unless absolutely necessary and documented with a comment.
- All function parameters and return types must be explicitly typed.
- Use `unknown` instead of `any` for untyped inputs, then validate with Zod.

### R2: Server vs Client Component Boundary
- **Default is Server Component** — do NOT add `'use client'` unless the component uses:
  - React hooks (`useState`, `useEffect`, etc.)
  - Browser APIs (`window`, `document`, etc.)
  - Event handlers (`onClick`, `onChange`, etc.)
  - Framer Motion animations
  - Third-party client-only libraries
- Keep client components as small as possible — push data fetching to server components.
- Never fetch data in client components directly. Use Server Actions + TanStack Query.

### R3: No Direct Database Access in Components
- Components NEVER import from `@/lib/db` directly.
- All database operations go through Server Actions (`src/actions/`).
- Server Actions are the ONLY layer that talks to the database.

### R4: Validation at Every Boundary
- Every Server Action MUST validate input with Zod before touching the database.
- Every form MUST use React Hook Form with `zodResolver`.
- Never trust client-side data — always revalidate on the server.

### R5: No Floating Point for Money
- All monetary values in MMK are integers (no decimals needed for Myanmar Kyat).
- Use `Math.round()` for any calculated values.
- Database schema uses `decimal(15, 0)` for monetary fields.
- Never use `toFixed()` for calculations — only for display.

### R6: Single Source of Truth for Prices
- `inventory_items.unit_price` is the canonical price.
- When creating a quotation, SNAPSHOT the price into `quotation_items.unit_price`.
- Quotation item prices are frozen at creation time and don't change if inventory prices change.
- The pricing engine (`src/lib/pricing/engine.ts`) is a pure function — no side effects.

---

## 🟡 IMPORTANT RULES (Always Follow)

### R7: File Organization
- One component per file. File name matches component name in kebab-case.
- `ProjectCard` → `project-card.tsx`
- Group by feature, not by type:
  ```
  ✅ components/project/project-card.tsx
  ✅ components/quotation/quote-builder.tsx
  ❌ components/cards/project-card.tsx
  ❌ components/builders/quote-builder.tsx
  ```

### R8: Import Aliases
- Always use the `@/` path alias (maps to `src/`).
  ```tsx
  ✅ import { db } from '@/lib/db';
  ❌ import { db } from '../../../lib/db';
  ```

### R9: Server Action Response Format
- Every Server Action returns: `{ success: true, data: T }` or `{ success: false, error: string }`.
- Never throw errors from Server Actions — always catch and return error responses.
- Use `revalidatePath()` after mutations to refresh server-rendered data.

### R10: Error Handling
- Every page route has a corresponding `error.tsx` boundary.
- Every list page has an empty state UI (not just a blank screen).
- Every data-loading state has a skeleton UI.
- Network errors show a toast notification with retry option.
- 401 responses redirect to `/login`.

### R11: Naming Conventions
| Thing | Convention | Example |
|---|---|---|
| Component files | kebab-case | `project-card.tsx` |
| Component names | PascalCase | `ProjectCard` |
| Hook files | kebab-case with `use-` prefix | `use-projects.ts` |
| Hook functions | camelCase with `use` prefix | `useProjects` |
| Server Action files | kebab-case with `-actions` suffix | `project-actions.ts` |
| Server Action functions | camelCase | `createProject` |
| Store files | kebab-case with `-store` suffix | `ui-store.ts` |
| Zod schemas | camelCase with `Schema` suffix | `createProjectSchema` |
| DB schema tables | camelCase (Drizzle convention) | `projectCosts` |
| DB column names | snake_case (PostgreSQL convention) | `created_at` |
| CSS variables | kebab-case with `--` prefix | `--accent-solar` |
| Route segments | kebab-case | `/quotations/new` |

### R12: shadcn/ui Component Usage
- Install components via CLI: `pnpm dlx shadcn@latest add <component>`
- NEVER modify files in `src/components/ui/` directly.
- Customize appearance ONLY via CSS variables in `globals.css`.
- For custom variants, create wrapper components in feature folders.
- Example: need a "Solar Button"? Create `components/shared/solar-button.tsx` that wraps `<Button>`.

### R13: Animation Rules
- Use Framer Motion for all animations.
- Import animation presets from `@/lib/motion.ts` — do not define inline.
- Use `LazyMotion` with `domAnimation` to reduce bundle size.
- All animations must:
  - Respect `prefers-reduced-motion` (use `useReducedMotion` hook)
  - Run at 60fps (no heavy layout animations)
  - Have duration ≤ 500ms (except ambient/looping animations)
- Page transitions use `AnimatePresence` with `mode="wait"`.

### R14: State Management Boundaries
| State Type | Tool | Never Use |
|---|---|---|
| Server/DB data | TanStack Query | ❌ Zustand, ❌ useState |
| UI state (modals, theme) | Zustand | ❌ Context, ❌ useState for global state |
| Form data | React Hook Form | ❌ useState for form fields |
| URL state (filters, tabs) | searchParams | ❌ Zustand for URL-derived state |
| Local component state | useState | Fine for simple local toggles |

### R15: Responsive Design
- Mobile-first approach: design for 375px first, then scale up.
- Breakpoints: `sm:640px`, `md:768px`, `lg:1024px`, `xl:1280px`, `2xl:1440px`
- Bottom navigation dock is always visible on all screen sizes.
- Dialogs become bottom sheets on mobile (`< md`).
- Quote builder: single column on mobile, split pane on `lg+`.
- Max content width: `1400px`, centered.
- All touch targets: minimum `44x44px`.

### R16: Accessibility
- Every interactive element must have an accessible label.
- All images must have meaningful `alt` text.
- Color is never the only indicator — always pair with icon or text.
- Focus states must be visible (don't remove outline without replacement).
- Form errors must be associated with inputs via `aria-describedby`.
- Navigation landmarks: `<nav>`, `<main>`, `<header>` are required.

---

## 🟢 GUIDELINES (Strongly Recommended)

### R17: Performance
- Lazy-load components below the fold with `next/dynamic`.
- Use `React.memo` for expensive list item components (or trust React Compiler).
- Debounce search inputs (300ms).
- Prefetch links on hover using `<Link prefetch>`.
- Images use `next/image` with explicit `width` and `height`.

### R18: Security
- Session cookies: `httpOnly`, `secure`, `sameSite: 'lax'`, `maxAge: 7d`.
- Never expose database IDs in error messages.
- Validate file upload types server-side (don't trust client).
- Rate limit login attempts (basic counter in KV).
- Never log sensitive data (passwords, session IDs).

### R19: Git Conventions
- Commit messages: `<type>: <description>` (e.g., `feat: add quotation PDF generation`)
- Types: `feat`, `fix`, `refactor`, `style`, `docs`, `chore`, `perf`
- One feature per commit — atomic commits.
- Never commit `.env.local`, `node_modules`, `public/sw.js`, `.next/`.

### R20: Code Comments
- Don't comment obvious code.
- DO comment business logic decisions:
  ```tsx
  // Snapshot price at quote time — inventory price changes should NOT affect existing quotes
  unitPrice: inventoryItem.unitPrice,
  ```
- DO comment non-obvious technical decisions:
  ```tsx
  export const runtime = 'nodejs'; // react-pdf requires Node.js APIs, cannot run on edge
  ```
- Preserve existing comments when editing code unless they're incorrect.

---

## 🚫 NEVER DO

1. **Never install packages with npm or yarn** — always use `pnpm`.
2. **Never create a traditional left sidebar navigation** — use bottom dock + command bar.
3. **Never use generic admin dashboard card layouts** — follow "Solar Flow" design system.
4. **Never use `console.log` in production code** — use proper error handling.
5. **Never hardcode colors** — always use CSS variables or Tailwind theme tokens.
6. **Never use inline styles** — use Tailwind classes or CSS modules.
7. **Never create API routes for simple CRUD** — use Server Actions instead.
8. **Never store sensitive data in localStorage** — use httpOnly cookies for auth.
9. **Never use `fetch` in client components to call own API** — use Server Actions + TanStack Query.
10. **Never skip Zod validation in Server Actions** — it's the last line of defense.
11. **Never use `var`** — always `const` or `let`.
12. **Never use `==`** — always `===`.
13. **Never use `any`** — always properly type or use `unknown` + validation.
14. **Never deploy without `pnpm typecheck` and `pnpm lint` passing.**

---

## 📁 Files You Must NEVER Edit

These files are auto-generated or managed by tools:

- `src/components/ui/*` — managed by shadcn/ui CLI
- `public/sw.js` — generated by Serwist
- `node_modules/` — managed by pnpm
- `.next/` — managed by Next.js
- `drizzle/migrations/*.sql` — generated by Drizzle Kit (review but don't hand-edit)

---

## 📁 Files You MUST Keep Updated

When adding new features:
- [ ] Update `src/lib/db/schema.ts` if new tables/columns needed
- [ ] Add Zod validators in `src/lib/validators/`
- [ ] Add Server Actions in `src/actions/`
- [ ] Add TanStack Query hooks in `src/hooks/`
- [ ] Add `loading.tsx` and `error.tsx` for new route segments
- [ ] Add SEO metadata in `page.tsx` via `export const metadata`
- [ ] Update navigation if new top-level routes added
