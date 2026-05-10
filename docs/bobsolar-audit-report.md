# BOB Solar — Deep Code Audit

**Repo:** `bobsolar` (Next.js 16 PWA, React 19, TS 6 strict, Drizzle, Postgres, Vercel Blob)
**Date:** 2026-05-10
**Reviewer:** Devin
**Scope:** Bugs, logic failures, security gaps, data-integrity risks, performance pain points, UX issues, real-world business blockers.
**Style:** Findings are categorized by severity. Each finding cites file paths and line numbers as evidence and pairs with a recommended fix.

---

## Severity Legend

- **P0 — Blocker:** Breaks core business workflow, corrupts data, or exposes the system. Fix before launch.
- **P1 — High:** Wrong behavior under normal conditions, silent data loss, or visible UX deception.
- **P2 — Medium:** Latent bug, performance concern, or maintenance pain that will bite within months.
- **P3 — Low:** Cosmetic / nice-to-have.

---

## Executive Summary

The codebase is well-structured (server actions, Drizzle, RSC, query client) but it has several **production-blocking bugs** in the quote-to-cash path — the most important business workflow:

1. The "Review & Send" button does **not** actually mark a quote as `sent`.
2. Per-line-item discounts are silently **lost** every time a draft is reloaded — total stored in DB ≠ total shown after edit.
3. The new-quote page does **not** reset Zustand state, so a freshly-clicked "New Quote" comes pre-filled with the previously-viewed customer & line items.
4. `updateQuotation` clobbers `discountPercent` / `taxPercent` / `customerId` to `0` / `null` if those fields aren't in the payload.
5. Money math runs on JS floats but is stored in `decimal(15,0)` columns → silent ±1 MMK rounding drift across thousands of quotes.
6. Notifications are written to the DB but **there is no UI to display them** — the bell badge is a hardcoded dot.
7. Company name, address, phone, tax ID, and bank details are **hardcoded** in `quote-document.tsx`. Editing requires a code deploy.
8. There is **no `error.tsx`, `loading.tsx`, or `not-found.tsx`** anywhere in `src/app` (AGENT.md Phase 5 requirement). Any uncaught error renders the default Next.js error page in prod.
9. Quote/project number generation is racy and the `unique` constraint surfaces as a generic "Failed to save" toast.
10. Several routes referenced from the Command Bar (`/customers/new`, `/projects/new` without a quoteId) lead to 404 / dead-end pages.

A non-trivial amount of the AGENT.md spec is missing entirely (dashboard "Energy Flow Canvas", notification panel, settings/company info form, user management, password change, logout button, error boundaries, loading skeletons).

---

## P0 — Blockers

### P0-1. "Review & Send" button does not actually send the quote

**File:** `src/app/(dashboard)/quotations/new/components/quote-editor.tsx:41-88`, `src/actions/quotation-actions.ts:126-208`, `src/actions/quotation-actions.ts:274-362`

`handleSave` is called with `'draft'` or `'sent'`, but neither `createQuotation` nor `updateQuotation` accepts a `status` parameter — they hardcode `status: 'draft'` (create) or omit it entirely (update). The toast lies to the user: it shows _"Quotation sent successfully"_ while the DB still has `status='draft'`.

```ts
// quote-editor.tsx:41
const handleSave = async (status: 'draft' | 'sent' = 'draft') => {
  ...
  const res =
    mode === 'create'
      ? await createQuotation(data)         // never sets status
      : await updateQuotation(quotationId!, data);
  ...
  toast.success(status === 'sent' ? 'Quotation sent successfully' : 'Quotation created');
}
```

**Impact:** Sales team thinks they sent a quote — the customer never receives one (and the status filter "Sent" stays empty). They will only discover this when chasing follow-ups and seeing 0 sent quotes.

**Fix:** Pass `status` through the action and call `updateQuotationStatus` (or extend the create/update payload) so `'sent'` actually transitions state.

---

### P0-2. Per-line-item discount data loss on every edit

**File:** `src/stores/quote-builder-store.ts:150-167`, `src/lib/db/schema.ts:161-172`

The `quotationItems` schema has **no `discountPercentage` column**, but the editor lets users set per-line discounts. The discount is folded into `totalPrice` at save time, but on reload `loadFromQuotation` hardcodes `discountPercentage: 0` for every item:

```ts
// quote-builder-store.ts:165
discountPercentage: 0, // Drizzle schema doesn't have per-item discount yet, but builder supports it
```

**Impact loop on edit:**

1. Save quote with line item: 1 panel × 100,000 MMK × 10% off → totalPrice = 90,000 (stored).
2. Reopen draft. Editor loads with `discountPercentage: 0`. UI now shows 100,000.
3. User saves any unrelated edit → editor recalculates totalPrice = 100,000 → DB now has 100,000.

Per-line-item discounts are silently destroyed on _every_ re-save. This is destructive **data loss** and a customer-facing pricing inconsistency between the saved/sent quote and the next iteration.

**Fix:** Either (a) add `discount_percentage` column to `quotation_items` and persist it, or (b) remove the per-line discount UI and only support a global discount.

---

### P0-3. New Quote page is contaminated by previously-viewed quote

**File:** `src/app/(dashboard)/quotations/new/page.tsx:1-5`, `src/stores/quote-builder-store.ts:60-76`

```ts
export default function NewQuotationPage() {
  return <QuoteEditor mode="create" />;
}
```

`QuoteEditor` does **not** call `reset()` on mount. The Zustand store is module-scoped and survives navigation. After viewing or editing an existing draft (which calls `loadFromQuotation`), clicking "New Quote" lands on `/quotations/new` with the _previous_ customer, items, discount, and notes pre-loaded. The user can easily save a "new" quote that is in fact a copy of someone else's.

**Impact:** Wrong customer billed, wrong items shipped. In a 3-person shop sharing the same admin login this _will_ happen.

**Fix:** In `NewQuotationPage` (server) or `QuoteEditor` (client), `useEffect(() => reset(), [])` when `mode === 'create'`, OR scope the store per-quote ID, OR put builder state in URL/query params.

---

### P0-4. `updateQuotation` clobbers discount/tax/customer when fields are missing

**File:** `src/actions/quotation-actions.ts:290-320`

```ts
const validated = updateQuotationSchema.parse(raw); // .partial() — all optional
...
.set({
  customerId: validated.customerId,                                  // → undefined (NOT NULL violation)
  subtotal: pricing.subtotal.toString(),                             // recalculated from possibly-empty items
  discountPercent: (validated.discountPercent || 0).toString(),      // 0 silently overwrites
  ...
  taxPercent: (validated.taxPercent || 0).toString(),                // 0 silently overwrites
  total: pricing.total.toString(),                                   // becomes 0 if items omitted
})
```

If a future caller (or a partial PATCH) sends only `notes`, the action will:

1. Try to set `customer_id = NULL` (NOT NULL constraint → throws).
2. Replace `discountPercent` and `taxPercent` with `0` even if user only wanted to update notes.
3. Recompute `subtotal/total` to `0` from an empty `items` array (since `validated.items` is undefined).

The current UI always sends the whole form so this is latent today, but the schema explicitly advertises `partial()` — an external integration or a single field edit will silently destroy a quote.

**Fix:** When fields are absent from the input, **don't include them in the SET clause**. Only pass `validated.items` through the items-replace branch (already correct), and apply the same "only include if defined" pattern to the parent record fields.

---

### P0-5. Floating-point money math + integer DB columns = silent rounding drift

**File:** `src/lib/pricing/engine.ts:19-53`, `src/lib/db/schema.ts:143-170`

```ts
const discount = basePrice * (discountPercentage / 100); // float
const taxAmount = afterDiscount * (taxPercentage / 100); // float
```

`subtotal`, `discountAmount`, `taxAmount`, `total` columns are `decimal(15, 0)` — **integer-only**. When float results like `899.1` or `944.055` are written via `.toString()`, Postgres truncates to the integer. Effects:

- Displayed total in the editor preview ≠ stored total in DB ≠ total on PDF.
- Sum of `quotation_items.totalPrice` ≠ `quotations.subtotal` because each line is rounded independently.
- The pricing tests in `engine.test.ts` only cover cases that _happen_ to produce integers, so this never gets caught.

In MMK terms 1–2 MMK doesn't matter, but the **inconsistency** between three views of the same quote will be flagged by the customer ("the email said 1,234,568, the PDF says 1,234,567"). For a small business this destroys trust.

**Fix:** Use integer math throughout. Per-line: `Math.floor(qty*price) - Math.floor(qty*price*pct/10000)`. Globals: round once at the end. Keep one source of truth (line `totalPrice` sums) and derive `subtotal`/`total` from it. Add property-based tests with non-integer-friendly inputs (e.g., 7%, 33%, prime quantities).

> Side note: `quotation_items.quantity` is `decimal(12, 2)` — fractional quantities allowed. Consider whether labor (often sold per-hour) really wants this, or whether to pin to integer.

---

### P0-6. Notifications are written but never displayed

**File:** `src/lib/notifications/broadcast.ts`, `src/app/(dashboard)/layout.tsx:43-50`, `src/lib/db/schema.ts` (notifications table)

`notifyAllUsers` is invoked on project completion (`project-actions.ts:174`) and budget overrun (`project-actions.ts:194`). Rows are inserted into `notifications`. But:

```tsx
// dashboard/layout.tsx
<Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-full">
  <Bell className="h-5 w-5" />
  <span className="bg-solar absolute top-2.5 right-2.5 h-2 w-2 rounded-full" />{' '}
  {/* hardcoded */}
</Button>
```

- The bell button is non-functional (no `onClick`).
- The unread indicator is a static dot — always shown, even with zero notifications.
- There is no notification panel, no list view, no mark-as-read flow.
- `notifications` table fills up indefinitely.

**Impact:** Budget overrun warnings — the most important risk signal in the app — are written into a black hole. Project-completion confirmations never reach staff. The visible "you have unread notifications" indicator is a lie.

**Fix:** Build the AGENT.md Phase 4.2 deliverable: bell with real unread count from `notifications` where `userId = currentUser AND readAt IS NULL`, slide-in panel, mark-as-read action, mark-all-as-read, real-time refresh via `revalidatePath` or polling.

---

### P0-7. No `error.tsx` / `loading.tsx` / `not-found.tsx` anywhere

**File:** `src/app/**` (search shows none exist)

Required by AGENT.md Phase 5.1. Without these:

- Any thrown error in a server action that bubbles past the `try/catch` (e.g., DB connection drop, unique-constraint violation in number generation) renders Next's default red error page in dev or a generic 500 in prod.
- No skeleton states; every navigation shows the page render delay as a frozen frame (the dashboard layout already suspends under React 19 RSC).
- Hitting a non-existent route (e.g., `/quotations/new` → typo `/quotation/new`) shows the framework default 404, not the brand 404.

**Impact:** Production failures are user-visible as cryptic Next.js errors. Loss of brand trust.

**Fix:** Add `error.tsx`, `loading.tsx` per route segment, and a global `not-found.tsx`. Wire `error.tsx` to log via `logError()` in `src/lib/utils/error.ts`.

---

### P0-8. Hardcoded company info & bank details in PDF

**File:** `src/components/pdf/quote-document.tsx:30-42`

```ts
const COMPANY_INFO = {
  name: 'BOB Solar',
  address: '123 Solar Street, Yangon, Myanmar', // placeholder
  phone: '+95 9 123 456 789', // placeholder
  email: 'info@bobsolar.com',
  taxId: 'TIN-2026-XXXXX', // placeholder
};
const BANK_DETAILS = `KBZ Bank | A/C: 123-456-789-0 | ...`;
```

These ship in **every PDF the customer sees**. A change of bank account, address, or even a typo requires a code change + redeploy. The settings page (`settings/page.tsx`) supports only logo upload — no fields for company info or bank details, despite AGENT.md Phase 4.3 specifying them.

**Impact:** A small business cannot operate this way — bank details, addresses, and tax IDs change. Sending PDFs with the wrong bank account = customers paying the wrong account.

**Fix:** Persist company settings in `company_settings` (key/value table already exists). Render company info from DB in the PDF. Build the Settings → Company form.

---

### P0-9. `/api/upload` is whitelisted as public path; no CSRF

**File:** `src/proxy.ts:3-10`, `src/app/api/upload/route.ts:8-66`

```ts
// proxy.ts
const PUBLIC_PATHS = ['/login', '/api']; // ALL of /api bypasses proxy
```

The proxy lets any `/api/*` route through. The route handler does its own session check — fine — but:

- Any future `/api/*` route will start unauthenticated by default. Easy to forget the per-route check.
- The upload route validates session via cookie only; **no CSRF token, no `origin` check**. An attacker-controlled page on another origin can issue a `multipart/form-data` POST with `credentials: 'include'`. Same-site cookies (`sameSite: 'lax'`) protect against this for top-level navigations but `lax` does **not** block cross-site `<form>` POSTs. (Strictness depends on browser interpretation, but the design relies on browser specifics.)
- File-type validation is missing entirely (the upload accepts any `file.type`, the 5MB cap and image-only check only happen client-side in `file-upload.tsx`). Server-side, no validation of MIME, no extension whitelist, no path traversal protection on `folder`.

**Impact:** An authenticated user (or a CSRF-tricked browser) can upload arbitrary content into the company's Vercel Blob, potentially blowing the 1GB free tier and serving anything (HTML, JS) under the trusted domain.

**Fix:**

1. Replace `/api` blanket whitelist with per-route `/api/auth/*` etc.
2. Add `Origin`/`Sec-Fetch-Site` checks or a CSRF token to upload.
3. Server-side validate `file.type` against an allowlist and `file.size` against a max.
4. Sanitize `folder` (reject `..`, leading `/`, etc.).

---

### P0-10. Auto-generated quote/project numbers race under concurrency

**File:** `src/actions/quotation-actions.ts:146-156`, `src/actions/project-actions.ts:91-101`

```ts
const lastQuote = await db.query.quotations.findFirst({
  where: and(sql`${quotations.createdAt} >= ${yearStart}`),
  orderBy: [desc(quotations.quoteNumber)],
});
let nextSequence = 1;
if (lastQuote) nextSequence = extractSequence(lastQuote.quoteNumber) + 1;
```

Two simultaneous saves both read `lastQuote.quoteNumber = QT-2026-0007`, both compute `nextSequence = 8`, both INSERT `QT-2026-0008`. The unique constraint catches one, but:

- `handleActionError` returns a generic `"Failed to create quotation"` toast.
- The user has no idea what went wrong; the data they typed is preserved client-side but they assume the system is broken.
- Same exact pattern in `nextProjectSequence` for `PJ-{year}-{seq}`.

**Impact:** With 3 users, races are rare but not impossible (e.g., two staff finishing quotes at end-of-day). The error message is opaque, leading to support cost.

**Fix:** Either (a) wrap the read+insert in a `SERIALIZABLE` transaction with retry on conflict, (b) introduce a `quote_sequences` table with `UPDATE ... RETURNING`, or (c) detect the unique-constraint violation and retry with `seq + 1` automatically.

> Bonus bug: the `desc(quoteNumber)` ordering is **lexical**. With 4-digit padding it works up to `9999`. If a year ever exceeds 9999 quotes, sorting will pick `QT-2026-9999` over `QT-2026-10000`, and sequence generation regresses. Switch to `desc(createdAt)` and parse, or store the sequence as an integer column.

---

## P1 — High Severity

### P1-1. `discountPercentage` per item is dropped from item insert

Tied to P0-2 above. Even ignoring the round-trip data loss, the create/update path computes `totalPrice` with the discount applied but never persists `discountPercentage`. The PDF can show "Total: 90,000" but cannot break it down ("Was 100,000, 10% off"). For a customer-facing document that's a real downgrade.

**File:** `src/actions/quotation-actions.ts:180-192`

---

### P1-2. Empty Customer/Project search UX

**File:** `src/components/layout/command-bar.tsx:80-92`, `src/app/(dashboard)/customers/[id]/page.tsx`, `src/app/(dashboard)/projects/new/page.tsx`

The CommandBar offers `/customers/new` and `/projects/new` but:

- `/customers/new` is matched by the `[id]` dynamic route. `getCustomer('new')` runs `eq(uuid, 'new')` which Postgres rejects (`invalid input syntax for type uuid: "new"`). The action returns generic "Failed to fetch customer" → page renders "Customer not found".
- `/projects/new` without `?quoteId=` shows a placeholder telling the user to come from "Convert to Project" — i.e., there is no scratch-create flow.

**Fix:** Either build `/customers/new` and `/projects/new` as real create flows, or remove them from the Command Bar.

---

### P1-3. Sessions never refresh; `cleanupExpiredSessions` never runs

**File:** `src/lib/auth/session.ts:74-103`

`getSessionAndRefresh` is **defined but never called** anywhere (`grep` confirms). The dashboard layout only calls `requireAuth()` → `getSessionFromCookie()` → `getSession()` (which doesn't refresh). So:

- A user is logged out abruptly exactly 7 days after login, regardless of activity.
- The `sessions` table grows without bound — `cleanupExpiredSessions()` is never scheduled or triggered.

**Fix:** (a) Call `getSessionAndRefresh()` at the layout boundary so sliding-window expiry actually slides; (b) periodically clean up via Vercel Cron, or DELETE expired sessions inline whenever `getSession()` finds an expired one.

---

### P1-4. `Sales Team` placeholder on every quote card

**File:** `src/components/quotations/quotation-card.tsx:142-145`

```tsx
<User className="h-3 w-3" />
Sales Team
```

The schema has `quotations.createdBy` joined to `users.name`, but the card hardcodes "Sales Team". For a 2-staff team this is the difference between "Min created this" vs "Lin created this" — the only audit signal in the UI.

**Fix:** Include `createdBy` in `getQuotations()` join, render the actual user name.

---

### P1-5. Delete Draft dropdown item is non-functional

**File:** `src/components/quotations/quotation-card.tsx:118-122`

```tsx
<DropdownMenuItem className="text-destructive">
  <Trash2 className="mr-2 h-4 w-4" />
  Delete Draft
</DropdownMenuItem>
```

No `onClick`. Clicking does nothing. Item is shown for _every_ status (drafts, sent, accepted, rejected, expired) — even though `deleteQuotation` rejects non-draft.

**Fix:** Wire to `useDeleteQuotation()` mutation. Conditionally render only for `status === 'draft'`.

---

### P1-6. `accepted` is a terminal state — no way to undo a wrongly-accepted quote

**File:** `src/lib/validators/quotation.ts:49-58`

```ts
export const QUOTATION_STATUS_TRANSITIONS = {
  draft: ['sent', 'draft'],
  sent: ['accepted', 'rejected', 'expired'],
  accepted: [], // terminal — cannot go back
  rejected: ['draft'],
  expired: [],
};
```

If a customer says yes then changes their mind, or staff fat-finger "Mark Accepted", there is no path back. The user must duplicate the quote and ignore the wrong one.

**Fix:** Allow `accepted → rejected` or `accepted → draft` (with admin role check), unless a project has already been converted from it (then keep accepted to preserve referential integrity).

---

### P1-7. Inventory `canEdit={true}` hardcoded for all roles

**File:** `src/app/(dashboard)/inventory/page.tsx:107-114`

```tsx
<InventoryCard
  canEdit={true} // In real app, check role
  ...
/>
```

The dev acknowledges in a comment that role isn't checked. Server actions require admin, so staff who try to edit see error toasts. Worse, the card's UX (hover for edit/delete) is identical for both roles, suggesting capability staff don't actually have.

**Fix:** Pass real role from `requireAuth()` (you already do this in projects/[id]). Hide edit/delete UI when not admin.

---

### P1-8. `parseFloat(price)` for unitPrice in inline edit

**File:** `src/components/inventory/inventory-card.tsx:63-68`

```ts
updateItem({ id: item.id, data: { unitPrice: parseFloat(price) } });
```

User types "100,000.50" → parseFloat returns 100000.5 → DB column is `decimal(15, 0)` → Postgres rounds to 100000 (or 100001 depending on rounding mode). UX shows whatever decimal the user typed; DB silently strips it. Same `parseInt(stock)` without radix — `parseInt('010', 0)` is 10 in modern JS but reads ambiguous; bigger risk is no validation: negative, NaN, etc. all flow through.

**Fix:** Validate + parse to integer. Reject decimals with a toast.

---

### P1-9. Customer delete cascades silently, no warning

**File:** `src/actions/customer-actions.ts:140-156`, `src/lib/db/schema.ts` (FKs)

```ts
// Comment in code:
// Check if customer has any linked quotations/projects (optional, but good practice)
// For now, we'll just allow deletion if the user is admin.
await db.delete(customers).where(eq(customers.id, id));
```

`customers → quotations` has `onDelete: 'cascade'` → deleting a customer wipes every quote you ever sent them, including accepted ones with money attached. `customers → projects` has no cascade → delete fails with FK error → the user sees "Failed to delete customer" with no hint why.

**Impact:**

- Quotations are the company's record of what was offered. Cascading them on customer delete is a destructive operation with no undo.
- "Failed to delete customer" without a reason is a known support-cost generator.

**Fix:** Hard-block delete when quotations or projects exist. Offer "Archive" (soft delete via a flag) instead, OR show a confirmation that explicitly lists what will be cascaded.

---

### P1-10. Search is name-only on quotations

**File:** `src/actions/quotation-actions.ts:54`, `src/app/(dashboard)/quotations/page.tsx:75`

```ts
search ? ilike(quotations.quoteNumber, `%${search}%`) : undefined;
```

The placeholder says _"Search by quote number..."_ but real-world workflow is "search by customer name". Salesperson asking "what's the latest quote for U Hla?" has to scroll the list.

**Fix:** Also search joined `customers.name`.

---

### P1-11. `status='expired'` is never set automatically

**File:** none — the absence is the bug.

`quotations.validUntil` is captured but no code checks it. A quote dated `validUntil: 2024-01-01` still shows up under "Sent" indefinitely.

**Fix:** Either (a) Vercel Cron job nightly: `UPDATE quotations SET status='expired' WHERE status='sent' AND valid_until < NOW()`, or (b) compute "is_expired" derived in queries. Add an "Expired" tab to the quotations page (currently missing — see P2-1).

---

### P1-12. `quotations` decimal columns nullable when they shouldn't be

**File:** `src/lib/db/schema.ts:144-153`

```ts
discountPercent: decimal('discount_percent', { precision: 5, scale: 2 }).default('0'),
discountAmount: decimal('discount_amount', { precision: 15, scale: 0 }).default('0'),
taxPercent:     decimal('tax_percent',      { precision: 5, scale: 2 }).default('0'),
taxAmount:      decimal('tax_amount',       { precision: 15, scale: 0 }).default('0'),
```

Missing `.notNull()`. The DB allows `NULL` for these even though every code path assumes they're non-null. A migration tool, manual SQL, or a Drizzle bug could leave a row with `taxAmount = NULL`, and `Number(null) → 0`, `Number(undefined) → NaN` quietly diverge depending on how the row is read.

**Fix:** Add `.notNull()` and run a migration to backfill any nulls.

---

### P1-13. Spread-assignment leaks `id` into UPDATE SET

**File:** `src/actions/customer-actions.ts:110-118`, `src/actions/inventory-actions.ts:117-127`

```ts
const validated = updateCustomerSchema.parse({ ...raw, id });
const [item] = await db.update(customers).set({ ...validated, ... }).where(...);
```

`validated` includes `id`. The SET clause is now trying to update the primary key to itself — at best a no-op, at worst a write amplification or error depending on Drizzle internals (and migrations to a different ID type would crash).

**Fix:** Destructure `const { id: _id, ...patch } = validated;` and pass `patch` to `.set()`.

---

### P1-14. `bulkUpdatePrices` has no Zod validation

**File:** `src/actions/inventory-actions.ts:164-187`

Accepts `{ id: string; unitPrice: number }[]` but never validates shape. Calls `update.unitPrice.toString()` on whatever was passed → NaN → Postgres error or silent bad data. No transaction rollback is triggered properly because the `for` loop awaits each query individually — `db.transaction` gives atomicity only because Drizzle wraps it, but a malformed input still requires explicit input validation.

Also: N round-trips to Postgres for N items. With Neon serverless this is slow.

**Fix:** Add a Zod schema. Use a single `INSERT ... ON CONFLICT DO UPDATE` with a `VALUES` table, or `CASE`-based UPDATE.

---

### P1-15. `runtime dependencies` are listed under `devDependencies`

**File:** `package.json:30-63`

Many production-runtime packages are in `devDependencies`:

```
@react-pdf/renderer  — used by /quotations/[id]/pdf at runtime
@serwist/next        — service worker, runtime
@tanstack/react-query — runtime
bcryptjs             — auth, runtime
drizzle-orm          — DB, runtime
framer-motion        — runtime
lucide-react         — icons, runtime
next-themes          — runtime
postgres             — runtime DB driver
react-hook-form      — runtime
sonner               — toasts
zod                  — validation, runtime
zustand              — state
clsx, tailwind-merge — runtime utilities
```

Vercel installs devDependencies during build so production builds work, but **any non-Vercel deployment** (Docker, self-host, Railway, Fly with `pnpm install --prod`) will fail at runtime with `Cannot find module '@react-pdf/renderer'`. Even on Vercel, this misclassification is professionally embarrassing and inflates the dev-only install footprint.

**Fix:** Move runtime packages to `dependencies`. Keep `eslint`, `prettier`, `drizzle-kit`, `tsx`, `vitest`, `@types/*`, `tailwindcss`, `dotenv`, etc., in `devDependencies`.

---

### P1-16. `quote-document.tsx` uses `'use client'` but is rendered server-side

**File:** `src/components/pdf/quote-document.tsx:1`

`@react-pdf/renderer` runs on the server (Node) inside the route handler. Marking the file `'use client'` is incorrect: it tells the bundler this is a client component, then it's imported and called from a Server Component / Route Handler. In Next 16 / React 19 this _can_ compile but creates an extra client-bundle entry that ships unused JS to every page that touches anything in the import chain, and confuses tree-shaking.

**Fix:** Remove `'use client'`. The PDF renderer is server-only.

---

### P1-17. PDF renderer fetches Google Fonts at every cold start

**File:** `src/components/pdf/quote-document.tsx:11-27`

`Font.register({ src: 'https://fonts.gstatic.com/...' })` issues an HTTP request from the serverless function on cold start to fetch the woff2. On Vercel free tier with sporadic traffic, every PDF download cold-starts and pays the font-fetch cost (often 1–3s). Worse: if Google Fonts is briefly unreachable, the PDF generation fails with a confusing error.

**Fix:** Bundle the font file in `public/fonts/` and reference it via the deployed URL or use a built-in font. Even better, use `react-pdf`'s default Helvetica.

---

### P1-18. Hardcoded password in seed

**File:** `src/lib/db/seed.ts:9`

```ts
const adminPassword = await hashPassword('admin123');
```

For a public repo (or one shared with the friend), the initial admin password is in version control. There is no UI for password change. Anyone who clones the repo and finds a deployed instance can log in.

**Fix:** Generate a random password during seed and print it once to the operator. Build a "Change password" page (AGENT.md Phase 4.3 user management).

---

### P1-19. No logout button visible in the UI

**File:** `src/app/(dashboard)/layout.tsx:42-57`

The avatar circle is a plain `<div>` with a `User` icon — no menu, no logout. There's no other UI affordance to call `logout()` either. Users are stuck in the session until cookie expiry. (`auth-actions.ts` likely has a `logout()` action but no component imports it — `grep` would confirm.)

**Fix:** Wrap the avatar in a `DropdownMenu` with at least Profile / Logout.

---

### P1-20. PDF route allows fetching any quote regardless of role

**File:** `src/app/(dashboard)/quotations/[id]/pdf/route.ts:14-46`

The route checks the session is valid but does not check that the user is allowed to see this specific quote. With just two staff in this tenant it doesn't matter today. But: if the quote ID is leaked / guessable (UUIDv4 isn't guessable, OK) and a session cookie exists from any staff role, anyone can pull any PDF. There's also no rate-limit; PDFs are expensive (font fetch, render). Trivially easy to DoS the free-tier serverless minutes.

**Fix:** No-op for now (3 users, all internal). But document it. Add rate limiting later.

---

## P2 — Medium Severity

### P2-1. "Expired" quotes are invisible from the list filters

**File:** `src/app/(dashboard)/quotations/page.tsx:15-21`

```tsx
const TABS = [
  { id: 'all', ... },
  { id: 'draft', ... },
  { id: 'sent', ... },
  { id: 'accepted', ... },
  { id: 'rejected', ... },
  // 'expired' missing
];
```

Combined with P1-11 (no auto-expire), this means expired quotes only appear under "All" with a yellow badge — easy to miss.

---

### P2-2. `getQuotations` returns _all_ rows, no pagination

**File:** `src/actions/quotation-actions.ts:50-69`

`db.query.quotations.findMany({ where, with: { customer: ... }, orderBy: ... })` — no `limit`/`offset`. With 5 quotes/week × 52 weeks × 5 years = 1,300 quotes. Each row payload includes the joined customer. The query gets slower year over year and the page hauls increasing JSON.

**Fix:** `limit: 50` default, infinite-scroll or pagination. Mirror what `getProjects` does.

---

### P2-3. `getProjects` N+1 cost summation

**File:** `src/actions/project-actions.ts:366-376`

```ts
const items = await Promise.all(
  rows.map(async (r) => {
    const costTotal = await sumProjectCosts(r.project.id); // N queries
    return { ...r.project, ..., costTotal };
  }),
);
```

For a list of 50 projects, this is 50+ extra DB round-trips just for cost totals. With Neon's per-query latency this dominates page-load.

**Fix:** Single aggregated query: `SELECT project_id, SUM(amount) FROM project_costs WHERE project_id IN (...) GROUP BY project_id`. Build a Map.

---

### P2-4. `getProject` writes on every read

**File:** `src/actions/project-actions.ts:454`

```ts
await persistActualTotal(id); // recalculates actualTotal from costs and writes it
const actualTotalComputed = await sumProjectCosts(id);
```

Every project detail page-load issues an UPDATE. Two of the three users opening the same project causes contention. Also the `projects.actualTotal` column duplicates derived data and gets out of sync if anyone modifies costs without going through the action.

**Fix:** Either drop `projects.actualTotal` (compute on-read) or persist only on cost-change actions, not on read.

---

### P2-5. Budget overrun threshold drift on cost deletion

**File:** `src/actions/project-actions.ts:182-200`

`maybeNotifyBudgetOverrun` only fires when `actual` _crosses_ 110% of `quoted`. Logic:

```ts
if (actual <= threshold) return;
if (previousSpend > threshold) return;
```

If a cost is deleted bringing `actual` below threshold, the "previousSpend" snapshot resets — but the action is only called from `addProjectCost`, not from `deleteProjectCost`. So:

1. Add cost → cross 110% → notify.
2. Delete that cost → drop below 110% → no "back to safe" notification.
3. Add cost again → cross 110% again → notify again? Yes, because `previousSpend` (from before the new cost) is below threshold → it notifies again. Spam pattern.

**Fix:** Track an explicit `lastBudgetWarningAt` flag on the project rather than computing from previous spend.

---

### P2-6. Warranty alert dates ignore timezone

**File:** `src/actions/project-actions.ts:124-148`, `src/lib/db/schema.ts` (warranty_alerts)

```ts
dueDate: addYears(now, 1); // server's `now` in UTC
```

Server runs UTC. Customers and staff are in `Asia/Yangon` (UTC+6:30). A project completed at 22:00 Yangon time (15:30 UTC) gets warranty `dueDate` of next year 15:30 UTC, which is the _day after_ in Yangon. Off-by-one-day errors when displaying "Due tomorrow" / "Due today".

**Fix:** Render with `formatInTimeZone(date, 'Asia/Yangon', 'yyyy-MM-dd')`. Be consistent — never trust local `Date` formatting in serverless.

---

### P2-7. `seedDefaultWarrantyAlerts` always inserts 3 alerts on completion

**File:** `src/actions/project-actions.ts:124-148`, `503-541`

The completion path (`applyProjectCompletion`) calls `seedDefaultWarrantyAlerts`. There's no idempotency check. A `completed` project status is terminal so it can only be set once today — but if the validator ever allows un-complete + re-complete (likely future requirement), three duplicate alerts get added every cycle.

**Fix:** Insert with `ON CONFLICT DO NOTHING` keyed on `(projectId, alertType, description)` or check existence first.

---

### P2-8. `extractSequence` returns 0 on parse failure (silently)

**File:** `src/lib/utils/quote-number.ts:15-22`

```ts
if (parts.length < 3) return 0;
const seqPart = parts[2];
if (!seqPart) return 0;
return parseInt(seqPart, 10) || 0;
```

A corrupt `quoteNumber` like `QTQ-2026` returns 0 → next sequence is 1 → collision with `QT-2026-0001` → unique constraint failure → generic "Failed to create quotation" toast. Should at least log.

---

### P2-9. Free-tier connection pooling concern (Neon + postgres-js)

**File:** `src/lib/db/index.ts`

The repo uses `postgres` (postgres.js) directly, not `@neondatabase/serverless`. On serverless functions, postgres.js opens a TCP connection per cold-start and holds it. Vercel's lambda instances spawn N parallel pools → Neon free tier's pooled connection limit (~100) gets eaten quickly under traffic spikes.

**Fix:** Switch to `@neondatabase/serverless` (HTTP/WebSocket driver) for serverless, OR run the postgres.js client with `max: 1` and rely on Neon's pgbouncer.

---

### P2-10. `dotenv` loaded at module import in production

**File:** `src/lib/db/index.ts`, `drizzle.config.ts`

`config({ path: '.env.local' })` runs every time the module loads, including in the Vercel runtime. In production, env vars come from the platform — `dotenv` is a no-op but the import + IO call still happens. Cleaner to gate on `NODE_ENV !== 'production'`.

---

### P2-11. Two parallel test infrastructures

**File:** `package.json:16`, `src/lib/pricing/engine.test.ts`, `src/lib/pricing/run-tests.ts`

```json
"test": "tsx src/lib/pricing/run-tests.ts"
```

Vitest is in `devDependencies` and `engine.test.ts` is written in Vitest format, but `pnpm test` runs a hand-rolled `run-tests.ts` instead. Two ways to run "the tests" with overlapping but not identical assertions. Confusing for a future maintainer; tests get out of sync.

**Fix:** Pick one. Vitest is industry-standard.

---

### P2-12. No service worker registration

**File:** `next.config.ts`, `src/sw.ts`, `src/app/layout.tsx`

`@serwist/next` builds `public/sw.js` but I see no `serviceWorker.register('/sw.js')` call in any client component. Next 16 + Serwist usually auto-injects this, but check the actual client HTML — if the SW isn't registered, the PWA install prompt and offline behavior won't work, even though the manifest references it.

**Fix:** Verify with DevTools → Application → Service Workers. If missing, follow Serwist v9 register docs (`@serwist/next/register-sw` or manual register in `providers.tsx`).

---

### P2-13. Fixed stock-color thresholds

**File:** `src/components/inventory/inventory-card.tsx:57-61`

```ts
if (qty === 0) return 'red';
if (qty <= 10) return 'amber'; // hardcoded 10 for *every* category
```

Cable is sold per meter (10m is nothing). Panels per piece (10 panels is a lot). The same threshold makes "low stock" alarm misleading.

**Fix:** Per-category threshold (`min_stock_qty` column), or a percentile-based heuristic.

---

### P2-14. `window.confirm` for destructive actions

**File:** `src/components/inventory/inventory-card.tsx:78`

```ts
if (confirm('Are you sure you want to delete this item?')) ...
```

Native browser confirm is jarring on a custom-themed PWA, looks especially out of place in dark mode. Inconsistent with the rest of the design system (radix dialogs).

**Fix:** Use `AlertDialog` from shadcn.

---

### P2-15. `getCustomers`/`getCustomer` returns `total: items.length`

**File:** `src/actions/customer-actions.ts:32-39`, `src/actions/quotation-actions.ts:67`

`total` returned as the array length but no pagination — total is useless metadata. Future consumers might use it as "true total" and miscount.

**Fix:** Either implement pagination with separate count query, or remove the `total` field from the response.

---

### P2-16. `getCurrentUser()` returns null but `requireAuth()` redirects

**File:** `src/lib/auth/validate.ts`

Two patterns coexist:

- `getCurrentUser()` → `null` on no session.
- `requireAuth()` → throws via `redirect('/login')`.

Mixing these in the same codebase makes it easy to forget which one is in scope, leading to either unauthenticated access OR unexpected redirects. Consistency matters.

**Fix:** Pick one canonical pattern. For most flows, `requireAuth()` is right. Reserve `getCurrentUser()` for genuinely-optional contexts and document them.

---

### P2-17. Toast colors / labels disagree between buttons

**File:** `src/components/quotations/quotation-card.tsx:37-60`

Status `draft` is shown with `bg-slate-500/10 text-slate-500` here, but `bg-zinc-500/10 text-zinc-400 border-zinc-500/20` in `quote-detail-view.tsx:46`. Same status, two visual languages. Fragmentation; eventually a third file will show a third color.

**Fix:** Centralize a `STATUS_CONFIG` in one location.

---

### P2-18. `tabWhere` warranty boundaries use `gte/lte`

**File:** `src/actions/warranty-actions.ts` (per audit notes)

The "due_soon" window uses `gte(today)` and `lte(addDays(today, 30))`. The boundary at midnight on day 30 includes alerts due exactly that minute. Mostly harmless but combined with timezone drift (P2-6), it can cause flicker between tabs near boundaries.

---

### P2-19. `quotation_items.discount_percentage` missing means PDF can't itemize discounts

**File:** `src/components/pdf/quote-document.tsx:141-167`, `src/lib/db/schema.ts:161-172`

The PDF table shows `Description, Qty, Unit, Unit Price, Total`. There's no per-line "Discount" column — and the schema can't supply one because per-line discount isn't stored (P0-2). For a customer-facing document, "Was 100,000, now 90,000" is more persuasive than "90,000".

**Fix:** Once schema is fixed, add a Discount column to PDF.

---

### P2-20. Customer detail page has 4 tabs in JSX but only 3 are useful

**File:** `src/app/(dashboard)/customers/[id]/page.tsx:122-143`

Tabs: Overview / Quotations / Projects. Probably fine — but the search `searchCustomers` doesn't include email (only name+phone), inconsistent with `getCustomers` which searches all three. Subtle inconsistency that surfaces "I can find them in /customers but not in the command bar".

---

## P3 — Low Severity / Polish

### P3-1. `users.id` cascade not set on `quotations.createdBy`

**File:** `src/lib/db/schema.ts:139-141`

```ts
createdBy: uuid('created_by').references(() => users.id).notNull(),
```

No `onDelete`. If you ever delete a user, you can't (FK error) — which is conservative but also means user-deletion is a manual SQL operation. For a 3-user gift app, irrelevant.

---

### P3-2. `viewport.userScalable: false` blocks pinch-zoom

**File:** `src/app/layout.tsx:42-48`

```ts
export const viewport: Viewport = {
  ...
  maximumScale: 1,
  userScalable: false,
};
```

A11y violation. Vision-impaired users can't zoom the PWA on iOS/Android. PWAs targeting end-users should not lock zoom.

**Fix:** Remove `userScalable: false` and `maximumScale: 1`.

---

### P3-3. Bottom dock has 5 nav items; warranty isn't one of them

Per AGENT.md, the dock has Dashboard, Quotes, Projects, Inventory, Customers — Warranty is intentionally not there. Fine. But /warranty is a top-level page that's only reachable from the Command Bar (⌘K) or a "Warranty pulses" button on `/projects`. New users will struggle to find it. Consider a top-bar link or a card on the dashboard.

---

### P3-4. `Dashboard` page is a placeholder

**File:** `src/app/(dashboard)/page.tsx:1-8`

```tsx
export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1>Dashboard</h1>
      <p>Welcome to BOB Solar.</p>
    </div>
  );
}
```

AGENT.md Phase 4.1 specifies an "Energy Flow Canvas" with orbit visualization, Sankey pipeline, activity stream, etc. Not built. The single most-visited page after login shows literal "Welcome".

---

### P3-5. Fragments of unused imports and dead code

- `auth-actions.ts` `logout()` exists but is never called from any UI (P1-19).
- `getSessionAndRefresh` defined but never imported (P1-3).
- `cleanupExpiredSessions` defined but never scheduled (P1-3).
- `run-tests.ts` parallel to `engine.test.ts` (P2-11).

A `ts-prune` or `knip` pass would surface several more.

---

### P3-6. `formatMMK` does string-replace dance

**File:** `src/lib/pricing/engine.ts:55-67`

```ts
return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'MMK', ... })
  .format(amount).replace('MMK', '').trim() + ' MMK';
```

Different Node/V8 versions format MMK differently (some use "K", some "Ks", some "MMK"). Replacing the literal "MMK" might miss alternative outputs and produce e.g., "K100,000 MMK". Use `currencyDisplay: 'code'` and substring at fixed position, or just `amount.toLocaleString('en-US') + ' MMK'`.

---

### P3-7. `revalidatePath('/', 'layout')` is overkill

**File:** `src/actions/settings-actions.ts:52`

Logo URL change revalidates the entire app layout cache. With one logo the impact is small, but cache-busting `'layout'` for any cosmetic change is heavier than needed.

**Fix:** `revalidateTag('company-settings')` after tagging the fetcher.

---

### P3-8. AGENT.md Phase progress tracking is missing

The agent guide instructs marking off `[x]` in `docs/0?_progress_log_*.md`. Skim shows partial completion. Not a code bug, but a project-management drift signal.

---

### P3-9. Input validation: missing `<Input type="number" min={0}>` on inventory edit

**File:** `src/components/inventory/inventory-card.tsx:139, 174`

The inline price/stock edits use `<Input>` without `type="number"`, so the user can paste arbitrary text. Combined with `parseFloat` (P1-8), this causes silent data corruption.

---

## Real-World Business Blockers

These are the items that would prevent BOB Solar's two staff from running their day-to-day business with this app _as-is_:

| #   | Blocker                                                                | Reference   |
| --- | ---------------------------------------------------------------------- | ----------- |
| 1   | "Send" button does not send                                            | P0-1        |
| 2   | Per-line discounts vanish on edit                                      | P0-2        |
| 3   | New Quote shows previous customer's data                               | P0-3        |
| 4   | Notifications written, never displayed                                 | P0-6        |
| 5   | Hardcoded company info & bank details in every PDF                     | P0-8        |
| 6   | No way to log out from the UI                                          | P1-19       |
| 7   | No password change UI; admin password is `admin123` in version control | P1-18       |
| 8   | Customer delete cascades or fails silently                             | P1-9        |
| 9   | "Sales Team" placeholder instead of real creator name                  | P1-4        |
| 10  | "Delete Draft" dropdown does nothing                                   | P1-5        |
| 11  | Accepted quotes are terminal (no fix-up path)                          | P1-6        |
| 12  | Expired quotes never auto-expire and aren't filterable                 | P1-11, P2-1 |
| 13  | Dashboard is empty                                                     | P3-4        |
| 14  | Warranty page is hard to find                                          | P3-3        |
| 15  | No error/loading/not-found pages — production crashes look broken      | P0-7        |
| 16  | Settings page has only logo upload (no company info, no users)         | P0-8        |

A salesperson onboarding tomorrow would hit at least 5 of these in their first hour.

---

## Recommendations (suggested order)

**Sprint 1 — Stop the bleeding (P0):**

1. Fix the "Send" button (P0-1).
2. Reset Zustand store on `/quotations/new` mount (P0-3).
3. Stop clobbering discount/tax/customer in `updateQuotation` (P0-4).
4. Move company/bank info to `company_settings` and read from DB in PDF (P0-8).
5. Add `error.tsx`, `loading.tsx`, `not-found.tsx` per route (P0-7).
6. Build the notification panel (P0-6).
7. Add `discount_percentage` to `quotation_items` schema + persist it (P0-2).
8. Convert pricing engine to integer math, add property-based tests (P0-5).
9. Lock down `/api/upload` (origin check, MIME validation, folder sanitization) (P0-9).
10. Make sequence generation race-safe with retry on conflict (P0-10).

**Sprint 2 — Fix UX deception (P1):**

- Wire up `Delete Draft` (P1-5), real creator name (P1-4), logout (P1-19), expired auto-transition (P1-11).
- Allow `accepted → rejected/draft` (P1-6).
- Hide admin-only UI for staff (P1-7).
- Validate inputs (P1-8, P1-14).
- Move runtime packages out of devDependencies (P1-15).
- Fix `'use client'` on PDF (P1-16) and bundle fonts (P1-17).
- Customer-delete safeguards (P1-9).
- Fix session refresh (P1-3).
- Schema cleanups: `.notNull()` on quotations decimals (P1-12), drop `id` from spread (P1-13).
- Build basic Settings → Company form & user management (covers P0-8 + P1-18).

**Sprint 3 — Performance + polish (P2/P3):**

- Pagination on quotations (P2-2), single-query cost rollup (P2-3), drop write-on-read in `getProject` (P2-4).
- Switch to Neon serverless driver (P2-9).
- Standardize on Vitest, drop `run-tests.ts` (P2-11).
- Idempotent warranty alert seeding (P2-7).
- Build the Dashboard "Energy Flow Canvas" (P3-4).
- Restore pinch-zoom (P3-2).
- Centralize STATUS_CONFIG (P2-17).
- Per-category low-stock thresholds (P2-13).
- Replace `confirm()` with `AlertDialog` (P2-14).

---

## What Looks Good

To balance the report — these areas are well-implemented and shouldn't be touched:

- **DB schema relations & enums** are clean, foreign-key cascades are mostly right.
- **Server-action pattern with `ActionResponse<T>`** is consistent and ergonomic.
- **Quote number snapshot** approach (price stored on quote_items, not referenced from inventory) is correct.
- **Drizzle relational queries** with `with: { customer, items }` are idiomatic.
- **Zustand quote builder** is a clean store; the only issue is the missing reset.
- **Service-worker setup** via `@serwist/next` is appropriate for a PWA.
- **Tailwind + shadcn + framer-motion** stack is well-chosen and consistent.
- **`requireAuth` / `requireAdmin`** are tidy guards.
- **Drizzle migrations** are kept under `drizzle/migrations` (presumed).
- **Type safety** is high — minimal `any`, leverages `InferSelectModel`.

---

_End of audit._
