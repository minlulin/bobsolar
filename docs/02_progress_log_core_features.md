# BOB Solar — Progress Log Part 2: Core Features

> **Phase 2 — Inventory, Customer Management & Quotation System**
> Target: Week 3–5

---

## 2.1 Zod Validators (Shared Foundation)

### 2.1.1 Inventory Validators (`src/lib/validators/inventory.ts`)

- [x] `createInventoryItemSchema`:
  - [x] `name` — string, min 1, max 200
  - [x] `category` — enum (panel, inverter, battery, mounting, cable, accessory, labor)
  - [x] `unit` — enum (pcs, meter, set, kWp, job)
  - [x] `unitPrice` — number, min 0
  - [x] `stockQty` — integer, min 0
  - [x] `brand` — string, optional
  - [x] `modelNumber` — string, optional
  - [x] `isActive` — boolean, default true
- [x] `updateInventoryItemSchema` — partial of create, with `id` required
- [x] `inventoryFilterSchema` — category filter, search text, isActive
- [x] Export inferred types: `CreateInventoryItem`, `UpdateInventoryItem`

### 2.1.2 Customer Validators (`src/lib/validators/customer.ts`)

- [x] `createCustomerSchema`:
  - [x] `name` — string, min 1, max 200
  - [x] `email` — email format, optional
  - [x] `phone` — string, min 5, max 20
  - [x] `address` — string, optional
  - [x] `city` — string, optional
  - [x] `notes` — string, optional
- [x] `updateCustomerSchema` — partial with `id`
- [x] `customerFilterSchema` — search text
- [x] Export inferred types

### 2.1.3 Quotation Validators (`src/lib/validators/quotation.ts`)

- [x] `createQuotationSchema`:
  - [x] `customerId` — uuid
  - [x] `items` — array of:
    - [x] `itemId` — uuid
    - [x] `description` — string
    - [x] `quantity` — number, min 0.01
    - [x] `unitPrice` — number, min 0
    - [x] `sortOrder` — integer
  - [x] `discountPercent` — number, min 0, max 100, default 0
  - [x] `taxPercent` — number, min 0, max 100, default 0
  - [x] `notes` — string, optional
  - [x] `validUntil` — date, optional
- [x] `updateQuotationSchema` — partial with `id`
- [x] `updateQuotationStatusSchema` — `id` + `status` enum
- [x] Export inferred types

---

## 2.2 Inventory / Price & Stock Management

### 2.2.1 Server Actions (`src/actions/inventory-actions.ts`)

- [x] `getInventoryItems(filters?)` — list with optional category/search filter
  - [x] Query with Drizzle `select`, `where`, `orderBy`
  - [x] Support pagination: `limit`, `offset`
  - [x] Return typed array + total count
- [x] `getInventoryItem(id)` — single item by ID
- [x] `createInventoryItem(data)` — validate with Zod, insert, return item
- [x] `updateInventoryItem(id, data)` — validate, update, return item
- [x] `deleteInventoryItem(id)` — soft delete (set `isActive: false`)
- [x] `bulkUpdatePrices(items: {id, unitPrice}[])` — batch price update
- [x] `getInventoryCategories()` — distinct categories with counts
- [x] Error handling: wrap all in try/catch, return typed error responses

### 2.2.2 TanStack Query Hooks (`src/hooks/use-inventory.ts`)

- [x] `useInventoryItems(filters)` — queryKey: `['inventory', filters]`
  - [x] Stale time: 5 minutes
  - [x] Keep previous data on filter change
- [x] `useInventoryItem(id)` — single item query
- [x] `useCreateInventoryItem()` — mutation + invalidate list
- [x] `useUpdateInventoryItem()` — mutation + optimistic update
- [x] `useDeleteInventoryItem()` — mutation + optimistic removal
- [x] `useBulkUpdatePrices()` — mutation + invalidate all

### 2.2.3 Inventory Page (`src/app/(dashboard)/inventory/page.tsx`)

- [x] Page metadata: title "Inventory — BOB Solar"
- [x] **Layout:**
  - [x] Page header: "Inventory & Pricing" with item count badge
  - [x] "Add Item" button (solar gradient)
  - [x] Category filter pills (horizontal scrollable):
    - [x] All | Panels | Inverters | Batteries | Mounting | Cables | Accessories | Labor
    - [x] Active pill has solar glow indicator
  - [x] Search input with debounce (300ms)
- [x] **Item Grid / List:**
  - [x] Card grid layout (responsive: 1/2/3/4 columns)
  - [x] Each card shows:
    - [x] Category icon (solar-themed)
    - [x] Item name (bold)
    - [x] Brand + model (muted text)
    - [x] Unit price in MMK (formatted: `1,500,000 MMK`)
    - [x] Stock quantity with color-coded badge:
      - [x] Green (>10), Yellow (1-10), Red (0)
    - [x] Unit type badge (pcs, meter, etc.)
    - [x] Edit / Delete action buttons (icon only)
  - [x] Cards appear with staggered fade-up animation
  - [x] Card hover: subtle lift + shadow grow
- [x] **Inline Edit Mode:**
  - [x] Click price → inline number input
  - [x] Click stock → inline number input
  - [x] Auto-save on blur or Enter
  - [x] Show saving indicator (spinner on field)
  - [x] Optimistic update: UI updates instantly, reverts on error
- [x] **Empty state:** Solar-themed illustration + "Add your first item" CTA
- [x] **Loading state:** Skeleton cards matching layout

### 2.2.4 Add/Edit Item Dialog

- [x] Trigger: "Add Item" button or card edit button
- [x] Use shadcn `Dialog` (desktop) / `Sheet` (mobile)
- [x] Form fields:
  - [x] Item name (text input)
  - [x] Category (select dropdown)
  - [x] Unit (select dropdown)
  - [x] Unit price (number input, MMK formatted)
  - [x] Stock quantity (number input)
  - [x] Brand (text input, optional)
  - [x] Model number (text input, optional)
- [x] React Hook Form + Zod validation
- [x] Submit: show loading state on button
- [x] Success: close dialog, show success toast, list refreshes
- [x] Error: show icon error messages
- [x] Edit mode: pre-populate fields with existing data

### 2.2.5 Delete Confirmation

- [x] Confirm dialog: "Are you sure? This item may be referenced in quotes."
- [x] Soft delete (sets `isActive: false`)
- [x] **Phase 2.1: Foundation & Shared Logic**
- [x] **Phase 2.2: Inventory & Pricing Management**
- [/] **Phase 2.3: Customer Management (Basic CRM)**

---

## 2.3 Customer Management (Basic CRM)

### 2.3.1 Server Actions (`src/actions/customer-actions.ts`)

- [x] `getCustomers(filters?)` — list with search, pagination
- [x] `getCustomer(id)` — single customer with related quotations & projects count
- [x] `createCustomer(data)` — validate, insert, return
- [x] `updateCustomer(id, data)` — validate, update, return
- [x] `deleteCustomer(id)` — only if no linked quotations/projects
- [x] `searchCustomers(query)` — lightweight search for autocomplete (name/phone)

### 2.3.2 TanStack Query Hooks (`src/hooks/use-customers.ts`)

- [x] `useCustomers(filters)` — queryKey: `['customers', filters]`
- [x] `useCustomer(id)` — single with relations
- [x] `useCreateCustomer()` — mutation
- [x] `useUpdateCustomer()` — mutation + optimistic
- [x] `useDeleteCustomer()` — mutation
- [x] `useSearchCustomers(query)` — debounced autocomplete query

### 2.3.3 Customer List Page (`src/app/(dashboard)/customers/page.tsx`)

- [x] Page header: "Customers" with count
- [x] "Add Customer" button
- [x] Search bar with live filtering
- [x] **Customer cards layout:**
- [x] Avatar (first letter of name, solar gradient background)
- [x] Customer name (bold)
  - [x] Phone number
  - [x] City
  - [x] Linked data badges: "3 Quotes" · "1 Project"
- [x] **Customer Dialog:**
  - [x] Name, Phone (Required)
  - [x] Email, Address, City, Notes (Optional)
  - [x] Validation with Zod
  - [x] Server-side revalidation
- [x] Staggered entrance animation
- [x] Empty state: "Add your first customer"
- [x] Loading state: Skeleton cards
- [x] Toast notifications for all actions

### 2.3.4 Customer Detail Page (`src/app/(dashboard)/customers/[id]/page.tsx`)

- [x] **Tabs:**
  - [x] **Overview:** Address, notes, customer since date
  - [x] **Quotations:** List of linked quotes with status badges
  - [x] **Projects:** List of linked projects with status badges
- [x] Back navigation
- [x] Tab content uses staggered fade animation

- [x] Form fields: Name, Phone, Email, Address, City, Notes
- [x] React Hook Form + Zod validation
- [x] Success/error handling with toasts

---

## 2.4 Quotation Management

### 2.4.1 Price Calculation Engine (`src/lib/pricing/engine.ts`)

- [ ] `calculateLineItem(quantity, unitPrice): number`
  - [ ] Returns `quantity * unitPrice` using integer math (avoid float errors)
- [ ] `calculateQuotation(input)`:
  - [ ] Input: `items[]`, `discountPercent`, `taxPercent`
  - [ ] Calculate `subtotal` = sum of all line item totals
  - [ ] Calculate `discountAmount` = `subtotal * discountPercent / 100`
  - [ ] Calculate `afterDiscount` = `subtotal - discountAmount`
  - [ ] Calculate `taxAmount` = `afterDiscount * taxPercent / 100`
  - [ ] Calculate `total` = `afterDiscount + taxAmount`
  - [ ] Return all calculated values
- [ ] All calculations in integer smallest unit (e.g., 1 MMK = 1 unit, no decimals needed for MMK)
- [ ] Format helper: `formatMMK(amount: number): string` → `"1,500,000 MMK"`
- [ ] Unit tests for calculation engine:
  - [ ] Test basic calculation
  - [ ] Test with discount
  - [ ] Test with tax
  - [ ] Test with discount + tax
  - [ ] Test with zero items
  - [ ] Test with large numbers (millions of MMK)

### 2.4.2 Quote Number Generator

- [ ] `generateQuoteNumber(): string`
  - [ ] Pattern: `QT-{YEAR}-{SEQUENCE}`
  - [ ] Example: `QT-2026-0001`
  - [ ] Query last quote number from DB, increment sequence
  - [ ] Handle year rollover (reset sequence on new year)
- [ ] Ensure uniqueness with DB unique constraint

### 2.4.3 Server Actions (`src/actions/quotation-actions.ts`)

- [ ] `getQuotations(filters?)` — list with status filter, date range, pagination
  - [ ] Join customer name for display
  - [ ] Order by created_at DESC
- [ ] `getQuotation(id)` — single with items + customer details
- [ ] `createQuotation(data)`:
  - [ ] Validate with Zod
  - [ ] Generate quote number
  - [ ] Snapshot current prices from inventory
  - [ ] Calculate totals with pricing engine
  - [ ] Insert quotation + items in transaction
  - [ ] Return created quotation
- [ ] `updateQuotation(id, data)`:
  - [ ] Only if status is `draft`
  - [ ] Recalculate totals
  - [ ] Update items (delete old + insert new in transaction)
- [ ] `updateQuotationStatus(id, status)`:
  - [ ] Validate status transition rules:
    - [ ] `draft` → `sent` | `draft`
    - [ ] `sent` → `accepted` | `rejected` | `expired`
    - [ ] `accepted` → (no change, proceed to project conversion)
    - [ ] `rejected` → `draft` (reopen)
  - [ ] If `accepted` → trigger project creation option
- [ ] `deleteQuotation(id)` — only if status is `draft`
- [ ] `duplicateQuotation(id)` — clone as new draft with fresh prices

### 2.4.4 TanStack Query Hooks (`src/hooks/use-quotations.ts`)

- [ ] `useQuotations(filters)` — with stale time 30s
- [ ] `useQuotation(id)` — single with items
- [ ] `useCreateQuotation()` — mutation, invalidate list
- [ ] `useUpdateQuotation()` — mutation, optimistic
- [ ] `useUpdateQuotationStatus()` — mutation, optimistic status change
- [ ] `useDeleteQuotation()` — mutation
- [ ] `useDuplicateQuotation()` — mutation

### 2.4.5 Quote Builder Store (`src/stores/quote-builder-store.ts`)

- [ ] Zustand store for quote builder local state:
  - [ ] `selectedCustomerId: string | null`
  - [ ] `items: QuoteBuilderItem[]` (local array for drag/reorder)
  - [ ] `discountPercent: number`
  - [ ] `taxPercent: number`
  - [ ] `notes: string`
  - [ ] `validUntil: Date | null`
  - [ ] Derived: `subtotal`, `discountAmount`, `taxAmount`, `total` (auto-calculated)
- [ ] Actions:
  - [ ] `addItem(inventoryItem)` — add from search
  - [ ] `removeItem(index)`
  - [ ] `updateItemQuantity(index, qty)`
  - [ ] `updateItemPrice(index, price)` — override snapshot price
  - [ ] `reorderItems(fromIndex, toIndex)`
  - [ ] `setDiscount(percent)`
  - [ ] `setTax(percent)`
  - [ ] `reset()` — clear all
  - [ ] `loadFromQuotation(quotation)` — populate for editing

### 2.4.6 Quotation List Page (`src/app/(dashboard)/quotations/page.tsx`)

- [x] Page header: "Quotations" with count
- [x] "New Quote" button (solar gradient)
- [x] **Status filter tabs:**
  - [x] All | Draft | Sent | Accepted | Rejected | Expired
  - [x] Tab underline with solar glow animation
  - [x] Count badges on each tab
- [x] **Quote list (card-based, not table):**
  - [x] Quote number (e.g., `QT-2026-0001`)
  - [x] Customer name
  - [x] Total amount (formatted MMK)
  - [x] Status badge with color:
    - [x] Draft: gray
    - [x] Sent: blue/indigo
    - [x] Accepted: green/emerald
    - [x] Rejected: red
    - [x] Expired: yellow/amber
  - [x] Date created (relative: "2 days ago")
  - [x] Valid until date (if applicable)
  - [x] Quick actions: View, Edit (draft only), Duplicate, Delete (draft only)
  - [x] Fix TypeScript Error (TS7031) in `InventoryDialog` (Implicit any)
  - [x] Fix Zod type mismatches in Server Actions
  - [x] Fix unused variables and unescaped entities
  - [x] Create missing `form.tsx` and `ui-store.ts`
  - [x] Verify successful build with Next.js 16 / Turbopack
  - [x] Finalize Inventory CRUD & Pricing Management
  - [x] Click card → navigate to detail page
  - [x] Staggered entrance animation
  - [x] Empty state per filter tab
  - [x] Loading skeletons

### 2.4.7 Quote Builder Page (`src/app/(dashboard)/quotations/new/page.tsx`)

    - [ ] "Add Item" section:
      - [ ] Search inventory items (type-ahead)
      - [ ] Click result → adds to line items
    - [ ] **Line items list:**
      - [ ] Drag handle (for reorder)
      - [ ] Item name + description
      - [ ] Quantity input (number)
      - [ ] Unit price input (MMK, editable)
      - [ ] Line total (auto-calculated, bold)
      - [ ] Remove button (trash icon)
    - [ ] Drag-and-drop reordering with Framer Motion `Reorder`
    - [ ] **Summary section:**
      - [ ] Subtotal
      - [ ] Discount % input → calculated amount
      - [ ] Tax % input → calculated amount
      - [ ] **Grand Total** (large, bold, solar gradient text)
    - [ ] Notes textarea
    - [ ] Valid until date picker
    - [ ] Action buttons: Save as Draft, Send to Customer

- [ ] **Right pane (40%): Live Preview**
  - [ ] Mini PDF-like preview card
  - [ ] Shows company header, customer info, items table, totals
  - [ ] Updates in real-time as user edits
  - [ ] "Download PDF" button
- [ ] Mobile: stacked layout (builder on top, preview collapsed/expandable)
- [ ] All calculations update in real-time via Zustand store
- [ ] Unsaved changes warning before navigation

### 2.4.8 Quote Edit Page (`src/app/(dashboard)/quotations/[id]/page.tsx`)

- [ ] Load existing quotation data into builder store
- [ ] Same UI as builder but with pre-populated data
- [ ] Only editable if status is `draft`
- [ ] If not draft: show read-only detail view with:
  - [ ] Status badge (prominent)
  - [ ] Customer info card
  - [ ] Items table
  - [ ] Totals summary
  - [ ] Action buttons based on status:
    - [ ] Sent → "Mark Accepted" / "Mark Rejected"
    - [ ] Accepted → "Convert to Project"
    - [ ] Rejected → "Reopen as Draft"
  - [ ] "Download PDF" button
  - [ ] "Duplicate" button

### 2.4.9 PDF Generation

- [ ] **PDF Template (`src/components/pdf/quote-document.tsx`):**
  - [ ] Company header:
    - [ ] Logo (from Vercel Blob / company settings)
    - [ ] Company name, address, phone
    - [ ] Tax registration number
  - [ ] Quote details:
    - [ ] Quote number, date, valid until
    - [ ] Customer name, address, phone
  - [ ] Items table:
    - [ ] # | Description | Qty | Unit | Unit Price (MMK) | Total (MMK)
    - [ ] Alternating row backgrounds
  - [ ] Summary:
    - [ ] Subtotal, Discount, Tax, **Grand Total**
  - [ ] Footer:
    - [ ] Notes/terms
    - [ ] Bank details
    - [ ] "Thank you for choosing BOB Solar"
  - [ ] Professional styling: clean, solar-themed accent colors
- [ ] **PDF Route Handler (`src/app/(dashboard)/quotations/[id]/pdf/route.ts`):**
  - [ ] Authenticate request (check session)
  - [ ] Fetch quotation data with items + customer + company settings
  - [ ] Render PDF using `renderToStream()`
  - [ ] Return response with:
    - [ ] `Content-Type: application/pdf`
    - [ ] `Content-Disposition: inline; filename="QT-2026-0001.pdf"`
  - [ ] Handle errors: 404 if quotation not found
- [ ] **PDF Styles (`src/components/pdf/pdf-styles.ts`):**
  - [ ] Register custom fonts for PDF (Inter for body)
  - [ ] Define reusable style objects
- [ ] Test: PDF renders correctly with all data
- [ ] Test: PDF displays correctly in browser
- [ ] Test: PDF downloads with correct filename
- [ ] Test: Large quotation (30+ items) renders without issues

---

## Part 2 Completion Criteria

- [ ] Inventory CRUD fully functional with inline editing
- [ ] Customer CRUD fully functional with detail pages
- [ ] Quote builder creates quotes with correct calculations
- [ ] Quote status workflow transitions work correctly
- [ ] PDF generation produces professional documents
- [ ] All forms validate with Zod
- [ ] Optimistic updates work for common operations
- [ ] All pages have loading/empty/error states
- [ ] Search and filtering work across all list pages
- [ ] MMK formatting consistent throughout
