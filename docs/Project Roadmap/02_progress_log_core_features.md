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
- [x] **Phase 2.3: Customer Management (Basic CRM)**

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

- [x] `calculateLineItem(quantity, unitPrice): number`
  - [x] Returns `quantity * unitPrice` using integer math (avoid float errors)
- [x] `calculateQuotation(input)`:
  - [x] Input: `items[]`, `discountPercent`, `taxPercent`
  - [x] Calculate `subtotal` = sum of all line item totals
  - [x] Calculate `discountAmount` = `subtotal * discountPercent / 100`
  - [x] Calculate `afterDiscount` = `subtotal - discountAmount`
  - [x] Calculate `taxAmount` = `afterDiscount * taxPercent / 100`
  - [x] Calculate `total` = `afterDiscount + taxAmount`
  - [x] Return all calculated values
  - [x] All calculations in integer smallest unit (e.g., 1 MMK = 1 unit, no decimals needed for MMK)
  - [x] Format helper: `formatMMK(amount: number): string` → `"1,500,000 MMK"`
  - [x] Unit tests for calculation engine:
  - [x] Test basic calculation
  - [x] Test with discount
  - [x] Test with tax
  - [x] Test with discount + tax
  - [x] Test with zero items
  - [x] Test with large numbers (millions of MMK)

### 2.4.2 Quote Number Generator

- [x] `generateQuoteNumber(): string`
  - [x] Pattern: `QT-{YEAR}-{SEQUENCE}`
  - [x] Example: `QT-2026-0001`
  - [x] Query last quote number from DB, increment sequence
  - [x] Handle year rollover (reset sequence on new year)
- [x] Ensure uniqueness with DB unique constraint

### 2.4.3 Server Actions (`src/actions/quotation-actions.ts`)

- [x] `getQuotations(filters?)` — list with status filter, date range, pagination
  - [x] Join customer name for display
  - [x] Order by created_at DESC
- [x] `getQuotation(id)` — single with items + customer details
- [x] `createQuotation(data)`:
  - [x] Validate with Zod
  - [x] Generate quote number
  - [x] Snapshot current prices from inventory
  - [x] Calculate totals with pricing engine
  - [x] Insert quotation + items in transaction
  - [x] Return created quotation
- [x] `updateQuotation(id, data)`:
  - [x] Only if status is `draft`
  - [x] Recalculate totals
  - [x] Update items (delete old + insert new in transaction)
- [x] `updateQuotationStatus(id, status)`:
  - [x] Validate status transition rules:
    - [x] `draft` → `sent` | `draft`
    - [x] `sent` → `accepted` | `rejected` | `expired`
    - [x] `accepted` → (no change, proceed to project conversion)
    - [x] `rejected` → `draft` (reopen)
- [x] If `accepted` → trigger project creation option (Phase 3)
- [x] `deleteQuotation(id)` — only if status is `draft`
- [x] `duplicateQuotation(id)` — clone as new draft with fresh prices

### 2.4.4 TanStack Query Hooks (`src/hooks/use-quotations.ts`)

- [x] `useQuotations(filters)` — with stale time 30s
- [x] `useQuotation(id)` — single with items
- [x] `useCreateQuotation()` — mutation, invalidate list
- [x] `useUpdateQuotation()` — mutation, optimistic
- [x] `useUpdateQuotationStatus()` — mutation, optimistic status change
- [x] `useDeleteQuotation()` — mutation
- [x] `useDuplicateQuotation()` — mutation

### 2.4.5 Quote Builder Store (`src/stores/quote-builder-store.ts`)

- [x] Zustand store for quote builder local state:
  - [x] `selectedCustomerId: string | null`
  - [x] `items: QuoteBuilderItem[]` (local array for drag/reorder)
  - [x] `discountPercent: number`
  - [x] `taxPercent: number`
  - [x] `notes: string`
  - [x] `validUntil: Date | null`
  - [x] Derived: `subtotal`, `discountAmount`, `taxAmount`, `total` (auto-calculated)
- [x] Actions:
  - [x] `addItem(inventoryItem)` — add from search
  - [x] `removeItem(index)`
  - [x] `updateItemQuantity(index, qty)`
  - [x] `updateItemPrice(index, price)` — override snapshot price
  - [x] `reorderItems(fromIndex, toIndex)`
  - [x] `setDiscount(percent)`
  - [x] `setTax(percent)`
  - [x] `reset()` — clear all
  - [x] `loadFromQuotation(quotation)` — populate for editing

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

- [x] "Add Item" section: - [x] Search inventory items (type-ahead) - [x] Click result → adds to line items
  - [x] **Line items list:**
    - [x] Drag handle (for reorder)
    - [x] Item name + description
    - [x] Quantity input (number)
    - [x] Unit price input (MMK, editable)
    - [x] Line total (auto-calculated, bold)
    - [x] Remove button (trash icon)
  - [x] Drag-and-drop reordering with Framer Motion `Reorder`
  - [x] **Summary section:**
    - [x] Subtotal
    - [x] Discount % input → calculated amount
    - [x] Tax % input → calculated amount
    - [x] **Grand Total** (large, bold, solar gradient text)
  - [x] Notes textarea
  - [x] Valid until date picker
  - [x] Action buttons: Save as Draft, Send to Customer

- [x] **Right pane (40%): Live Preview**
  - [x] Mini PDF-like preview card
  - [x] Shows company header, customer info, items table, totals
  - [x] Updates in real-time as user edits
  - [x] "Download PDF" button (Note: Button is present but functionality depends on Phase 2.4.9)
- [x] Mobile: stacked layout (builder on top, preview collapsed/expandable)
- [x] All calculations update in real-time via Zustand store
- [x] Unsaved changes warning before navigation (Note: Basic implementation via back button and clear flow)

### 2.4.8 Quote Edit Page (`src/app/(dashboard)/quotations/[id]/page.tsx`)

- [x] Load existing quotation data into builder store
- [x] Same UI as builder but with pre-populated data
- [x] Only editable if status is `draft`
- [x] If not draft: show read-only detail view with:
  - [x] Status badge (prominent)
  - [x] Customer info card
  - [x] Items table
  - [x] Totals summary
  - [x] Action buttons based on status:
    - [x] Sent → "Mark Accepted" / "Mark Rejected"
    - [x] Accepted → "Convert to Project"
    - [x] Rejected → "Reopen as Draft"
  - [x] "Download PDF" button
  - [x] "Duplicate" button

### 2.4.9 PDF Generation

- [x] **PDF Template (`src/components/pdf/quote-document.tsx`):**
  - [x] Company header:
    - [x] Logo (from Vercel Blob / company settings)
    - [x] Company name, address, phone
    - [x] Tax registration number
  - [x] Quote details:
    - [x] Quote number, date, valid until
    - [x] Customer name, address, phone
  - [x] Items table:
    - [x] # | Description | Qty | Unit | Unit Price (MMK) | Total (MMK)
    - [x] Alternating row backgrounds
  - [x] Summary:
    - [x] Subtotal, Discount, Tax, **Grand Total**
  - [x] Footer:
    - [x] Notes/terms
    - [x] Bank details
    - [x] "Thank you for choosing BOB Solar"
  - [x] Professional styling: clean, solar-themed accent colors
- [x] **PDF Route Handler (`src/app/(dashboard)/quotations/[id]/pdf/route.ts`):**
  - [x] Authenticate request (check session)
  - [x] Fetch quotation data with items + customer + company settings
  - [x] Render PDF using `renderToStream()`
  - [x] Return response with:
    - [x] `Content-Type: application/pdf`
    - [x] `Content-Disposition: inline; filename="QT-2026-0001.pdf"`
  - [x] Handle errors: 404 if quotation not found
- [x] **PDF Styles (`src/components/pdf/pdf-styles.ts`):**
  - [x] Register custom fonts for PDF (Inter for body)
  - [x] Define reusable style objects
- [x] Test: PDF renders correctly with all data
- [x] Test: PDF displays correctly in browser
- [x] Test: PDF downloads with correct filename
- [x] Test: Large quotation (30+ items) renders without issues

---

## Part 2 Completion Criteria

- [x] Inventory CRUD fully functional with inline editing
- [x] Customer CRUD fully functional with detail pages
- [x] Quote builder creates quotes with correct calculations
- [x] Quote status workflow transitions work correctly
- [x] PDF generation produces professional documents
- [x] All forms validate with Zod
- [x] Optimistic updates work for common operations
- [x] All pages have loading/empty/error states
- [x] Search and filtering work across all list pages
- [x] MMK formatting consistent throughout
