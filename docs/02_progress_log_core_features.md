# BOB Solar — Progress Log Part 2: Core Features

> **Phase 2 — Inventory, Customer Management & Quotation System**
> Target: Week 3–5

---

## 2.1 Zod Validators (Shared Foundation)

### 2.1.1 Inventory Validators (`src/lib/validators/inventory.ts`)
- [ ] `createInventoryItemSchema`:
  - [ ] `name` — string, min 1, max 200
  - [ ] `category` — enum (panel, inverter, battery, mounting, cable, accessory, labor)
  - [ ] `unit` — enum (pcs, meter, set, kWp, job)
  - [ ] `unitPrice` — number, min 0
  - [ ] `stockQty` — integer, min 0
  - [ ] `brand` — string, optional
  - [ ] `modelNumber` — string, optional
  - [ ] `isActive` — boolean, default true
- [ ] `updateInventoryItemSchema` — partial of create, with `id` required
- [ ] `inventoryFilterSchema` — category filter, search text, isActive
- [ ] Export inferred types: `CreateInventoryItem`, `UpdateInventoryItem`

### 2.1.2 Customer Validators (`src/lib/validators/customer.ts`)
- [ ] `createCustomerSchema`:
  - [ ] `name` — string, min 1, max 200
  - [ ] `email` — email format, optional
  - [ ] `phone` — string, min 5, max 20
  - [ ] `address` — string, optional
  - [ ] `city` — string, optional
  - [ ] `notes` — string, optional
- [ ] `updateCustomerSchema` — partial with `id`
- [ ] `customerFilterSchema` — search text
- [ ] Export inferred types

### 2.1.3 Quotation Validators (`src/lib/validators/quotation.ts`)
- [ ] `createQuotationSchema`:
  - [ ] `customerId` — uuid
  - [ ] `items` — array of:
    - [ ] `itemId` — uuid
    - [ ] `description` — string
    - [ ] `quantity` — number, min 0.01
    - [ ] `unitPrice` — number, min 0
    - [ ] `sortOrder` — integer
  - [ ] `discountPercent` — number, min 0, max 100, default 0
  - [ ] `taxPercent` — number, min 0, max 100, default 0
  - [ ] `notes` — string, optional
  - [ ] `validUntil` — date, optional
- [ ] `updateQuotationSchema` — partial with `id`
- [ ] `updateQuotationStatusSchema` — `id` + `status` enum
- [ ] Export inferred types

---

## 2.2 Inventory / Price & Stock Management

### 2.2.1 Server Actions (`src/actions/inventory-actions.ts`)
- [ ] `getInventoryItems(filters?)` — list with optional category/search filter
  - [ ] Query with Drizzle `select`, `where`, `orderBy`
  - [ ] Support pagination: `limit`, `offset`
  - [ ] Return typed array + total count
- [ ] `getInventoryItem(id)` — single item by ID
- [ ] `createInventoryItem(data)` — validate with Zod, insert, return item
- [ ] `updateInventoryItem(id, data)` — validate, update, return item
- [ ] `deleteInventoryItem(id)` — soft delete (set `isActive: false`)
- [ ] `bulkUpdatePrices(items: {id, unitPrice}[])` — batch price update
- [ ] `getInventoryCategories()` — distinct categories with counts
- [ ] Error handling: wrap all in try/catch, return typed error responses

### 2.2.2 TanStack Query Hooks (`src/hooks/use-inventory.ts`)
- [ ] `useInventoryItems(filters)` — queryKey: `['inventory', filters]`
  - [ ] Stale time: 5 minutes
  - [ ] Keep previous data on filter change
- [ ] `useInventoryItem(id)` — single item query
- [ ] `useCreateInventoryItem()` — mutation + invalidate list
- [ ] `useUpdateInventoryItem()` — mutation + optimistic update
- [ ] `useDeleteInventoryItem()` — mutation + optimistic removal
- [ ] `useBulkUpdatePrices()` — mutation + invalidate all

### 2.2.3 Inventory Page (`src/app/(dashboard)/inventory/page.tsx`)
- [ ] Page metadata: title "Inventory — BOB Solar"
- [ ] **Layout:**
  - [ ] Page header: "Inventory & Pricing" with item count badge
  - [ ] "Add Item" button (solar gradient)
  - [ ] Category filter pills (horizontal scrollable):
    - [ ] All | Panels | Inverters | Batteries | Mounting | Cables | Accessories | Labor
    - [ ] Active pill has solar glow indicator
  - [ ] Search input with debounce (300ms)
- [ ] **Item Grid / List:**
  - [ ] Card grid layout (responsive: 1/2/3/4 columns)
  - [ ] Each card shows:
    - [ ] Category icon (solar-themed)
    - [ ] Item name (bold)
    - [ ] Brand + model (muted text)
    - [ ] Unit price in MMK (formatted: `1,500,000 MMK`)
    - [ ] Stock quantity with color-coded badge:
      - [ ] Green (>10), Yellow (1-10), Red (0)
    - [ ] Unit type badge (pcs, meter, etc.)
    - [ ] Edit / Delete action buttons (icon only)
  - [ ] Cards appear with staggered fade-up animation
  - [ ] Card hover: subtle lift + shadow grow
- [ ] **Inline Edit Mode:**
  - [ ] Click price → inline number input
  - [ ] Click stock → inline number input
  - [ ] Auto-save on blur or Enter
  - [ ] Show saving indicator (spinner on field)
  - [ ] Optimistic update: UI updates instantly, reverts on error
- [ ] **Empty state:** Solar-themed illustration + "Add your first item" CTA
- [ ] **Loading state:** Skeleton cards matching layout

### 2.2.4 Add/Edit Item Dialog
- [ ] Trigger: "Add Item" button or card edit button
- [ ] Use shadcn `Dialog` (desktop) / `Sheet` (mobile)
- [ ] Form fields:
  - [ ] Item name (text input)
  - [ ] Category (select dropdown)
  - [ ] Unit (select dropdown)
  - [ ] Unit price (number input, MMK formatted)
  - [ ] Stock quantity (number input)
  - [ ] Brand (text input, optional)
  - [ ] Model number (text input, optional)
- [ ] React Hook Form + Zod validation
- [ ] Submit: show loading state on button
- [ ] Success: close dialog, show success toast, list refreshes
- [ ] Error: show inline error messages
- [ ] Edit mode: pre-populate fields with existing data

### 2.2.5 Delete Confirmation
- [ ] Confirm dialog: "Are you sure? This item may be referenced in quotes."
- [ ] Soft delete (sets `isActive: false`)
- [ ] Toast notification on success
- [ ] Card animates out (scale-down + fade)

---

## 2.3 Customer Management (Basic CRM)

### 2.3.1 Server Actions (`src/actions/customer-actions.ts`)
- [ ] `getCustomers(filters?)` — list with search, pagination
- [ ] `getCustomer(id)` — single customer with related quotations & projects count
- [ ] `createCustomer(data)` — validate, insert, return
- [ ] `updateCustomer(id, data)` — validate, update, return
- [ ] `deleteCustomer(id)` — only if no linked quotations/projects
- [ ] `searchCustomers(query)` — lightweight search for autocomplete (name/phone)

### 2.3.2 TanStack Query Hooks (`src/hooks/use-customers.ts`)
- [ ] `useCustomers(filters)` — queryKey: `['customers', filters]`
- [ ] `useCustomer(id)` — single with relations
- [ ] `useCreateCustomer()` — mutation
- [ ] `useUpdateCustomer()` — mutation + optimistic
- [ ] `useDeleteCustomer()` — mutation
- [ ] `useSearchCustomers(query)` — debounced autocomplete query

### 2.3.3 Customer List Page (`src/app/(dashboard)/customers/page.tsx`)
- [ ] Page header: "Customers" with count
- [ ] "Add Customer" button
- [ ] Search bar with live filtering
- [ ] **Customer cards layout:**
  - [ ] Avatar (first letter of name, solar gradient background)
  - [ ] Customer name (bold)
  - [ ] Phone number
  - [ ] City
  - [ ] Linked data badges: "3 Quotes" · "1 Project"
  - [ ] Quick actions: View, Edit, Call (tel: link)
- [ ] Staggered entrance animation
- [ ] Empty state: "Add your first customer"
- [ ] Loading state: Skeleton cards

### 2.3.4 Customer Detail Page (`src/app/(dashboard)/customers/[id]/page.tsx`)
- [ ] **Header section:**
  - [ ] Large avatar
  - [ ] Customer name + city
  - [ ] Contact info (phone, email) with copy-to-clipboard
  - [ ] Edit button
- [ ] **Tabs:**
  - [ ] **Overview:** Address, notes, customer since date
  - [ ] **Quotations:** List of linked quotes with status badges
  - [ ] **Projects:** List of linked projects with status badges
- [ ] Back navigation
- [ ] Tab content uses staggered fade animation

### 2.3.5 Add/Edit Customer Dialog
- [ ] Form fields: Name, Phone, Email, Address, City, Notes
- [ ] React Hook Form + Zod validation
- [ ] Phone field: auto-format Myanmar phone numbers
- [ ] Success/error handling with toasts

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
- [ ] Page header: "Quotations" with count
- [ ] "New Quote" button (solar gradient)
- [ ] **Status filter tabs:**
  - [ ] All | Draft | Sent | Accepted | Rejected | Expired
  - [ ] Tab underline with solar glow animation
  - [ ] Count badges on each tab
- [ ] **Quote list (card-based, not table):**
  - [ ] Quote number (e.g., `QT-2026-0001`)
  - [ ] Customer name
  - [ ] Total amount (formatted MMK)
  - [ ] Status badge with color:
    - [ ] Draft: gray
    - [ ] Sent: blue/indigo
    - [ ] Accepted: green/emerald
    - [ ] Rejected: red
    - [ ] Expired: yellow/amber
  - [ ] Date created (relative: "2 days ago")
  - [ ] Valid until date (if applicable)
  - [ ] Quick actions: View, Edit (draft only), Duplicate, Delete (draft only)
- [ ] Click card → navigate to detail page
- [ ] Staggered entrance animation
- [ ] Empty state per filter tab
- [ ] Loading skeletons

### 2.4.7 Quote Builder Page (`src/app/(dashboard)/quotations/new/page.tsx`)
- [ ] **Split-pane layout:**
  - [ ] **Left pane (60%): Builder**
    - [ ] Customer selector (searchable dropdown, autocomplete)
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
    - [ ] Logo (from R2 / company settings)
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
