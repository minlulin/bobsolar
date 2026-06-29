# Improvement Plan: Quotation → Completed Project Workflow

**Date:** 2026-06-28  
**Source:** `docs/workflow-audit-quotation-to-completion.md` (GAP-1 through GAP-7, FRICTION-1, FRICTION-3, FRICTION-4)

---

## Phase 1: Short-term Workflow Improvements

### GAP-1: Partial PO Receipt Support

**Goal:** Allow receiving partial quantities per line item on a purchase order.

- [ ] **1.1** Add `receivedQuantity` column to `purchaseOrderItems` table (decimal, default 0) — `drizzle/00XX_partial-po-receipt.sql`
- [ ] **1.2** Add `receivedQuantity` field to `purchaseOrderItems` schema in `src/lib/db/schema.ts`
- [ ] **1.3** Create `src/lib/validators/purchase.ts` → `receivePartialPurchaseOrderSchema`:
  - `purchaseOrderId: z.uuid()`
  - `items: z.array(z.object({ lineItemId: z.uuid(), quantity: z.number().positive() }))`
- [ ] **1.4** Create `receivePartialPurchaseOrder` action in `src/actions/purchase-actions.ts`:
  - Lock PO row with `.for("update")`
  - For each line item: validate `receivedQuantity + quantity <= originalQuantity`
  - Increment `inventoryItems.stockQty` per line
  - Increment `purchaseOrderItems.receivedQuantity`
  - If all lines fully received → set PO `status: "received"`, `receivedAt: new Date()`
  - If partially received → keep `status: "draft"` (or new `"partially_received"`)
  - Create journal entry for the received portion only (debit raw_materials, credit accounts_payable)
  - `revalidateTag(CACHE_TAGS.INVENTORY_LIST, "max")`, `revalidatePath("/inventory")`, `revalidatePath("/purchases")`
- [ ] **1.5** Add unit tests in `src/actions/purchase-actions.test.ts`:
  - Receives partial quantities correctly
  - Rejects over-reception (received + new > ordered)
  - Sets PO to "received" when all lines complete
  - Creates correct journal entry for partial amount
- [ ] **1.6** Update `PurchaseDetailPageClient` to show per-line received vs ordered quantities
- [ ] **1.7** Add "Receive Partial" button (visible when PO is draft) that opens a line-item form
- [ ] **1.8** Run `pnpm typecheck && pnpm lint && pnpm test:code` — fix any failures

---

### GAP-6: Post-Completion Invoice Creation CTA

**Goal:** Guide users from "project completed" → "create invoice" with a prominent CTA.

- [ ] **2.1** Add `useCreateInvoice` hook in `src/hooks/use-invoices.ts` (if not exists)
- [ ] **2.2** In `src/app/(dashboard)/projects/[id]/project-detail-shell.tsx`:
  - When `proj.status === "completed"`, show a prominent "Create Invoice" CTA card above the voucher section
  - CTA navigates to `/invoices/new?projectId=${projectId}` or opens a modal
- [ ] **2.3** Create `src/app/(dashboard)/invoices/new/page.tsx` (if not exists):
  - Pre-populate `projectId` from search params
  - Pre-fill `customerId` from project's customer
  - Pre-fill `totalAmount` from project's `quotedTotal`
  - Pre-fill line items from quotation items (description, quantity, unitPrice)
- [ ] **2.4** Add unit test: "shows Create Invoice CTA for completed projects"
- [ ] **2.5** Run `pnpm typecheck && pnpm lint && pnpm test:code`

---

### FRICTION-1: Inline Project Conversion Modal

**Goal:** Allow converting an accepted quotation to a project without a separate page load.

- [ ] **3.1** Create `src/app/(dashboard)/quotations/[id]/components/convert-to-project-dialog.tsx`:
  - Dialog/Sheet component with site address, system size, notes fields
  - Pre-fill site address from customer.address + customer.city
  - Submit calls `convertQuotationToProject` action
- [ ] **3.2** Update `quote-detail-view.tsx`:
  - Replace "Initialize Project" link (line ~215) with a Dialog trigger
  - On success: `router.push(`/projects/${res.data.id}`)`
- [ ] **3.3** Add `useConvertToProject` hook (already exists in `src/hooks/use-projects.ts`)
- [ ] **3.4** Add unit test: "convert dialog creates project and navigates"
- [ ] **3.5** Run `pnpm typecheck && pnpm lint && pnpm test:code`

---

### FRICTION-3: Bulk Inventory Consumption

**Goal:** Allow consuming multiple inventory items in a single form submission.

- [ ] **4.1** Create `consumeBulkProjectInventorySchema` in `src/lib/validators/project.ts`:
  - `projectId: z.uuid()`
  - `items: z.array(z.object({ inventoryItemId: z.uuid(), quantity: z.number().int().min(1) })).min(1)`
  - `incurredDate: z.coerce.date()`
- [ ] **4.2** Create `consumeBulkProjectInventory` action in `src/actions/project-actions.ts`:
  - Wrap all consumptions in a single `db.transaction`
  - Lock all inventory rows (sorted by ID to prevent deadlocks)
  - Validate all items have sufficient stock before consuming any
  - Create all `projectCosts` records
  - Create all journal entries
  - Call `persistActualTotal` once at the end
  - `revalidateTag(CACHE_TAGS.INVENTORY_LIST, "max")`, `revalidatePath("/inventory")`
- [ ] **4.3** Add unit tests:
  - Bulk consume succeeds for multiple items
  - Bulk consume rolls back if any item has insufficient stock
  - Correct COGS calculation for bulk items
- [ ] **4.4** Add "Bulk Consume" button in project detail costs tab
- [ ] **4.5** Create `BulkConsumeDialog` component with dynamic line items (add/remove rows)
- [ ] **4.6** Run `pnpm typecheck && pnpm lint && pnpm test:code`

---

### FRICTION-4: Direct PDF Download for Quotations

**Goal:** Add a download button that triggers file download instead of opening a new tab.

- [ ] **5.1** Check if `/quotations/[id]/pdf/route.ts` exists and returns a `Response` with `Content-Disposition: attachment` header
- [ ] **5.2** If not, create/update the route to support `?download=1` query param that sets `Content-Disposition: attachment; filename="QUOTE-{quoteNumber}.pdf"`
- [ ] **5.3** Add a "Download PDF" button next to "Export PDF" in `quote-detail-view.tsx`:
  - Uses `<a href={url} download>` or triggers a fetch + blob download
- [ ] **5.4** Run `pnpm typecheck && pnpm lint`

---

## Phase 2: Medium-term Real-World Features

### GAP-2: Quotation Revision History

**Goal:** Track revisions to quotations with version numbers and history.

- [ ] **6.1** Add columns to `quotations` table:
  - `revisionNumber: integer("revision_number").default(1).notNull()`
  - `originalQuotationId: uuid("original_quotation_id")` (self-reference for revisions)
  - `revisionReason: text("revision_reason")`
- [ ] **6.2** Create migration `drizzle/00XX-quotation-revisions.sql`
- [ ] **6.3** Update `src/lib/db/schema.ts` with new columns and self-relation
- [ ] **6.4** Create `createQuotationRevision` action:
  - Accepts `originalQuotationId` + revised data
  - Copies original quotation items
  - Increments `revisionNumber`
  - Sets `originalQuotationId` to the first version's ID
  - Sets `status: "draft"` (needs to be re-sent)
- [ ] **6.5** Add `getQuotationRevisions` action to fetch revision history
- [ ] **6.6** Add "Revise" button on `sent` and `rejected` quotations in `quote-detail-view.tsx`
- [ ] **6.7** Show revision history in a timeline/accordion on the quotation detail page
- [ ] **6.8** Add unit tests:
  - Creates revision with incremented number
  - Revision preserves original line items
  - Revision starts as "draft"
- [ ] **6.9** Run `pnpm typecheck && pnpm lint && pnpm test:code`

---

### GAP-3: Deposit Tracking and Enforcement

**Goal:** Require advance deposit before project can start.

- [ ] **7.1** Add columns to `projects` table:
  - `depositRequired: boolean("deposit_required").default(false).notNull()`
  - `depositAmount: decimal("deposit_amount", { precision: 15, scale: 2 }).default("0")`
  - `depositReceived: boolean("deposit_received").default(false).notNull()`
- [ ] **7.2** Create migration `drizzle/00XX-project-deposit.sql`
- [ ] **7.3** Update `src/lib/db/schema.ts` with new columns
- [ ] **7.4** Update `convertToProjectSchema` to accept `depositRequired` and `depositAmount`
- [ ] **7.5** Update `updateProject` action:
  - Block `planning → in_progress` transition if `depositRequired && !depositReceived`
  - Return clear error message: "Cannot start project: deposit of X MMK required"
- [ ] **7.6** Update `recordPayment` action:
  - When `paymentType === "advance"` on a project with `depositRequired`, auto-set `depositReceived = true`
- [ ] **7.7** Update `ProjectDetailShell` to show deposit status badge and "Record Deposit" quick action
- [ ] **7.8** Add unit tests:
  - Blocks project start when deposit required but not received
  - Allows start after advance payment recorded
  - Auto-marks deposit received on advance payment
- [ ] **7.9** Run `pnpm typecheck && pnpm lint && pnpm test:code`

---

### GAP-5: Change Order Workflow

**Goal:** Handle mid-project variations (add/remove items, adjust pricing).

- [ ] **8.1** Create `projectChangeOrders` table in `src/lib/db/schema.ts`:
  - `id`, `projectId` (FK), `changeOrderNumber` (unique), `status` (draft/approved/rejected)
  - `description`, `additionalAmount`, `originalQuotationId` (FK, nullable)
  - `approvedBy`, `approvedAt`, `createdBy`, `createdAt`, `updatedAt`
- [ ] **8.2** Create `projectChangeOrderItems` table:
  - `id`, `changeOrderId` (FK), `itemId` (FK, nullable), `description`, `quantity`, `unitPrice`, `totalPrice`, `isAddition` (boolean)
- [ ] **8.3** Create migration `drizzle/00XX-change-orders.sql`
- [ ] **8.4** Create domain file `src/lib/domain/change-order.ts` with status transitions:
  - `draft → approved`, `draft → rejected`, `approved → cancelled`
- [ ] **8.5** Create `src/lib/validators/change-order.ts` schemas
- [ ] **8.6** Create change order actions:
  - `createChangeOrder` — creates draft change order
  - `approveChangeOrder` — applies changes to project (creates projectCosts, updates quotedTotal, creates journal entry)
  - `rejectChangeOrder` — marks as rejected
- [ ] **8.7** Add "Change Orders" tab in `ProjectDetailShell`
- [ ] **8.8** Add unit tests:
  - Creates change order as draft
  - Approve adds costs and updates project total
  - Reject preserves original state
- [ ] **8.9** Run `pnpm typecheck && pnpm lint && pnpm test:code`

---

### GAP-7: Project Handover Document Workflow

**Goal:** Generate handover PDF and require customer acknowledgment before final completion.

- [ ] **9.1** Add columns to `projects` table:
  - `handoverDate: timestamp("handover_date")`
  - `handoverAcknowledgedBy: text("handover_acknowledged_by")` (customer name)
  - `handoverAcknowledgedAt: timestamp("handover_acknowledged_at")`
  - `handoverPdfUrl: text("handover_pdf_url")`
- [ ] **9.2** Create migration `drizzle/00XX-project-handover.sql`
- [ ] **9.3** Update `src/lib/db/schema.ts` with new columns
- [ ] **9.4** Create `generateHandoverPdf` action:
  - Generates PDF with project summary, installed items, warranty info, terms
  - Returns PDF blob
- [ ] **9.5** Create `acknowledgeHandover` action:
  - Accepts `projectId`, `acknowledgedBy`
  - Sets `handoverAcknowledgedAt`, `handoverAcknowledgedBy`
- [ ] **9.6** Update `ProjectDetailShell`:
  - When `status === "installation_completed"`, show "Generate Handover" button
  - Show acknowledgment form (customer name, signature placeholder)
  - Show "Mark Completed" button only after handover acknowledged
- [ ] **9.7** Update `markProjectCompleted` guard:
  - Block completion if `installation_completed` but `!handoverAcknowledgedAt`
- [ ] **9.8** Add unit tests:
  - Blocks completion before handover acknowledgment
  - Allows completion after acknowledgment
  - PDF generation returns valid blob
- [ ] **9.9** Run `pnpm typecheck && pnpm lint && pnpm test:code`

---

## Phase 3: Long-term Operational Excellence (Deferred)

### GAP-4: Installation Team Assignment and Checklist

**Goal:** Track installation progress with team assignment and checklist.

- [ ] **10.1** Create `installationTeams` table:
  - `id`, `name`, `leaderId` (FK to users), `memberIds` (array or join table), `isActive`
- [ ] **10.2** Create `installationChecklistTemplates` table:
  - `id`, `category` (panel/inverter/battery/mounting), `itemName`, `isRequired`, `sortOrder`
- [ ] **10.3** Create `projectInstallationRecords` table:
  - `id`, `projectId` (FK), `teamId` (FK), `scheduledDate`, `startedDate`, `completedDate`
  - `status` (scheduled/in_progress/completed)
- [ ] **10.4** Create `projectInstallationChecklistItems` table:
  - `id`, `recordId` (FK), `templateId` (FK), `isCompleted`, `completedBy`, `completedAt`, `notes`
- [ ] **10.5** Create migration `drizzle/00XX-installation-tracking.sql`
- [ ] **10.6** Create domain file `src/lib/domain/installation.ts` with status transitions
- [ ] **10.7** Create validators in `src/lib/validators/installation.ts`
- [ ] **10.8** Create actions:
  - `assignInstallationTeam`
  - `updateInstallationStatus`
  - `completeChecklistItem`
  - `getInstallationProgress`
- [ ] **10.9** Update `ProjectDetailShell`:
  - Add "Installation" tab with team info, checklist progress bar
  - Show checklist items with completion toggles
- [ ] **10.10** Update `updateProject` action:
  - Block `in_progress → installation_completed` if installation not done
- [ ] **10.11** Add unit tests for all new actions
- [ ] **10.12** Run `pnpm typecheck && pnpm lint && pnpm test:code`

---

## Cross-cutting Concerns (Apply to All Phases)

- [ ] **CC-1** Ensure all new cache tags are added to `src/lib/cache-tags.ts`
- [ ] **CC-2** All new actions must use `revalidateTag` for all affected entity lists
- [ ] **CC-3** All new DB writes that affect stock must invalidate `CACHE_TAGS.INVENTORY_LIST`
- [ ] **CC-4** All new DB writes that affect project data must invalidate `CACHE_TAGS.PROJECTS_LIST`
- [ ] **CC-5** All new status transitions must be added to domain transition maps
- [ ] **CC-6** All new tables must have proper indexes on foreign keys
- [ ] **CC-7** All new actions must have unit tests covering success + failure paths
- [ ] **CC-8** Run full quality gate before each commit: `pnpm typecheck && pnpm lint && pnpm test:code`

---

## Dependency Graph

```
Phase 1 (can start immediately):
  ├── GAP-1 (Partial PO) ─── standalone
  ├── GAP-6 (Invoice CTA) ── standalone
  ├── FRICTION-1 (Convert modal) ── standalone
  ├── FRICTION-3 (Bulk consume) ── standalone
  └── FRICTION-4 (PDF download) ── standalone

Phase 2 (after Phase 1 or parallel):
  ├── GAP-2 (Revisions) ─── standalone
  ├── GAP-3 (Deposit) ─── depends on payment system (exists)
  ├── GAP-5 (Change Orders) ── standalone
  └── GAP-7 (Handover) ── depends on GAP-3 (deposit) for payment flow

Phase 3 (after Phase 2):
  └── GAP-4 (Installation) ── standalone but large; can be split into sub-phases
```

---

## Estimated Effort

| Phase                | Tasks                             | Est. Time     | Risk                    |
| -------------------- | --------------------------------- | ------------- | ----------------------- |
| Phase 1: Short-term  | 5 features, ~20 atomic tasks      | 2-3 days      | Low (additive changes)  |
| Phase 2: Medium-term | 4 features, ~30 atomic tasks      | 4-5 days      | Medium (schema changes) |
| Phase 3: Long-term   | 1 feature, ~12 atomic tasks       | 3-4 days      | Medium (new entities)   |
| **Total**            | **10 features, ~62 atomic tasks** | **9-12 days** | —                       |
