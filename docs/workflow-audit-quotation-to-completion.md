# Workflow Audit: Quotation → Completed Project
**Date:** 2026-06-28  
**Scope:** End-to-end pipeline from quotation creation through project completion, invoicing, payment, and voucher generation.

## Status: Fixes Applied ✅

All immediate bug fixes (BUG-1 through BUG-8) have been implemented and verified:
- ✅ `pnpm typecheck` — passed
- ✅ `pnpm lint` — passed (452 files, no fixes)
- ✅ `pnpm test:code` — 522 passed, 6 skipped (528 total)

---

## 1. Workflow Map (Current State)

```
[Create Quotation] → draft
        │
        ▼
   [Send Quote] → sent ──────────────────────────────┐
        │                                            │
        ├── [Accept] → accepted                      │
        │              │                             │
        │              ▼                             │
        │     [Convert to Project] → planning        │
        │              │                             │
        │              ▼                             │
        │     [Start Work] → in_progress             │
        │              │                             │
        │              ├── [On Hold] → on_hold ──────┤ (can go back to in_progress)
        │              │                             │
        │              ▼                             │
        │     [Installation Done] → installation_completed
        │              │                             │
        │              ▼                             │
        │     [Mark Completed] → completed           │
        │              │                             │
        │              ├── [Create Invoice] → draft  │
        │              │                             │
        │              ├── [Post Invoice] → unpaid   │
        │              │                             │
        │              ├── [Record Payment]          │
        │              │                             │
        │              └── [Generate Voucher]        │
        │                                            │
        ├── [Reject] → rejected → [Archive]          │
        │                                            │
        └── [Expire] → expired (cron) ───────────────┘
```

---

## 2. Hidden Bugs (Confirmed)

### BUG-1: `receivePurchaseOrder` never invalidates `INVENTORY_LIST` cache tag
**Severity:** High (M1 from Final_Audit)  
**File:** `src/actions/purchase-actions.ts:154-250`

When a PO is received, stock quantities are incremented in the DB, but the function only calls `revalidatePath` for `/purchases` and `/suppliers`. It **never** calls `revalidateTag(CACHE_TAGS.INVENTORY_LIST)` or `revalidatePath("/inventory")`. The inventory list is cached with `unstable_cache` under the `inventory:list` tag with a 300s TTL. Users will see stale stock levels for up to 5 minutes after receiving a PO.

**Fix:** Add `revalidateTag(CACHE_TAGS.INVENTORY_LIST, "max")` and `revalidatePath("/inventory")` to `receivePurchaseOrder`.

---

### BUG-2: `deleteProjectCost` restores stock but never invalidates `INVENTORY_LIST` cache tag
**Severity:** High (M2 from Final_Audit)  
**File:** `src/actions/project-actions.ts:1251-1325`

When a cost with an `itemId` is deleted (reversed), the stock is restored via `item.stockQty + qty`. However, the function only calls `revalidatePath` for `/projects` — it **never** calls `revalidateTag(CACHE_TAGS.INVENTORY_LIST)` or `revalidatePath("/inventory")`. The inventory page will show stale (lower) stock until the 300s cache expires.

**Fix:** Add `revalidateTag(CACHE_TAGS.INVENTORY_LIST, "max")` and `revalidatePath("/inventory")` to `deleteProjectCost`.

---

### BUG-3: `addProjectCost` allows `itemId` in schema but rejects it at runtime — confusing UX
**Severity:** Medium  
**File:** `src/lib/validators/project.ts:26-33` and `src/actions/project-actions.ts:1074-1076`

The `addProjectCostSchema` accepts `itemId: z.uuid().optional().nullable()`, but the action immediately rejects it with `"Use inventory consumption to attach inventory items to a project."` This means:
- The API contract advertises `itemId` as valid input
- The UI form could theoretically send it
- The error message is the only guard

**Fix:** Remove `itemId` from `addProjectCostSchema` entirely. It should only exist in `consumeProjectInventorySchema`. This makes the validator the single source of truth.

---

### BUG-4: `updateQuotation` allows editing `accepted` quotations (status guard missing)
**Severity:** Medium  
**File:** `src/actions/quotation-actions.ts:461`

The `updateQuotation` function checks `if (quote.status !== "draft" && quote.status !== "sent")` — but the `QuoteEditorWrapper` is only shown for `draft` status (page.tsx line 23). However, the `quote-detail-view.tsx` shows an "Edit Quote" button for both `draft` AND `sent` statuses (line 173). The edit route (`/quotations/[id]/edit`) is not blocked at the route level — it's only blocked by the status check in `updateQuotation`. If a user navigates directly to the edit URL for a `sent` quotation, the editor will load but the update will fail. Worse, there is no `/edit` route segment — the "Edit Quote" button links to `/quotations/${quotation.id}/edit` which doesn't exist as a directory, so it would 404.

**Fix:** Either (a) create a proper `/quotations/[id]/edit` route, or (b) remove the "Edit Quote" button for `sent` status and only allow editing drafts. The current state is a dead link for `sent` quotations.

---

### BUG-5: `accepted → draft` transition allows quote editing after acceptance, creating a logic hole
**Severity:** Medium  
**File:** `src/lib/domain/quotation.ts:16`

`QUOTATION_STATUS_TRANSITIONS` allows `accepted: ["draft", "rejected"]`. This means an accepted quotation can be moved back to draft, edited, and re-accepted — but the `convertQuotationToProject` function only checks `if (quotation.status !== "accepted")`. If a user converts to a project, then moves the quote back to draft, the project still exists and the quote becomes editable. The `updateQuotationStatus` function blocks status changes once a project is linked, but `updateQuotation` (which edits items/pricing) does NOT check for a linked project.

**Fix:** Add a linked-project check to `updateQuotation` similar to the one in `updateQuotationStatus`.

---

### BUG-6: `addProjectCost` allows `amount: 0.01` but `postInventoryConsumptionToProject` requires `amountRounded >= 1`
**Severity:** Low  
**File:** `src/lib/validators/project.ts:30` vs `src/actions/project-actions.ts:199`

The `addProjectCostSchema` allows amounts as low as 0.01, but the inventory consumption path rounds to integers and rejects amounts < 1. This inconsistency means sub-MMK amounts are allowed for manual costs but not inventory consumption. In practice this is fine (MMK doesn't use decimals), but the validator should enforce integer amounts for consistency.

**Fix:** Change `amount: z.number().min(0.01, ...)` to `amount: z.number().int().min(1, ...)` in `addProjectCostSchema`.

---

### BUG-7: `deleteProjectCost` does not invalidate `INVENTORY_LIST` cache tag when restoring stock
**Severity:** High (duplicate of BUG-2, listed separately for tracking)

---

### BUG-8: `PROJECTS_LIST` cache tag is defined but never used
**Severity:** Low  
**File:** `src/lib/cache-tags.ts:13`

`CACHE_TAGS.PROJECTS_LIST` is defined as `"projects:list"` but is never referenced in any `revalidateTag` call. The project list relies solely on `revalidatePath("/projects")` which is less granular. This means project list cache invalidation works but is not using the tag-based system consistently with other entities.

**Fix:** Add `revalidateTag(CACHE_TAGS.PROJECTS_LIST, "max")` to all project-mutating actions, or remove the unused constant.

---

## 3. Real-World Workflow Gaps

### GAP-1: No "Partial Delivery" or "Partial Receipt" for Purchase Orders
**Impact:** High for real-world operations

In real solar businesses, suppliers rarely deliver the full PO in one shipment. The current `receivePurchaseOrder` function is all-or-nothing: it receives the entire PO at once and increments all line items. There is no way to:
- Receive partial quantities per line item
- Track pending delivery quantities
- Handle backorders

**Suggestion:** Add a `receivePurchaseOrderItems` action that accepts `[{ poLineId, quantity }]` and increments stock per-line. Add `receivedQuantity` and `pendingQuantity` fields to `purchaseOrderItems`.

---

### GAP-2: No "Revision" or "Version" system for Quotations
**Impact:** High for real-world sales

In practice, customers often request multiple revisions before accepting. The current system allows editing `draft` and `sent` quotations in-place (overwriting the original), but there is no revision history. If a salesperson edits a `sent` quotation, the customer sees the new version with no indication that it changed.

**Suggestion:** 
- Add a `revisionNumber` field to quotations (default 1, increment on each edit-after-send)
- Or implement a "Revise" action that creates a new draft quotation linked to the original

---

### GAP-3: No "Deposit" or "Advance Payment" tracking before project start
**Impact:** Medium

The payment system supports `advance` and `final` payment types, but there is no workflow to:
- Require a deposit before project start
- Track deposit milestones
- Block project start until deposit is received

**Suggestion:** Add a `depositRequired` and `depositReceived` field to projects, and block `planning → in_progress` transition if deposit is required but not received.

---

### GAP-4: Project completion requires `installation_completed` status first, but there's no way to record installation progress
**Impact:** Medium

The workflow forces `in_progress → installation_completed → completed`, but there is no granular tracking of:
- Installation team assignment
- Installation start/end dates
- Installation checklist/inspection
- Photo documentation

**Suggestion:** Add an `installation` sub-stage with team assignment and checklist. This is a larger feature but critical for real-world solar operations.

---

### GAP-5: No "Change Order" or "Variation" workflow
**Impact:** High

In real projects, customers often request changes after the quotation is accepted (e.g., add more panels, change inverter). The current system has no way to:
- Create a change order linked to the original quotation
- Track additional costs/revenue from variations
- Maintain an audit trail of changes

**Suggestion:** Add a `projectChangeOrders` table with link to original quotation, additional items, and approval workflow.

---

### GAP-6: Invoice creation is disconnected from project completion
**Severity:** Medium  
**File:** `src/actions/invoice-actions.ts:103-115`

The `postInvoice` function requires `project.status === "completed"`, but there is no UI flow that guides the user from "project completed" → "create invoice" → "post invoice". The invoice creation is a separate manual step that users must remember to do.

**Suggestion:** After project completion, show a prominent "Create Invoice" CTA. Pre-populate the invoice from the quotation total.

---

### GAP-7: No "Warranty Registration" or "Handover Document" workflow
**Impact:** Medium

The system generates warranty alerts on completion, but there is no:
- Customer-facing handover document
- Warranty registration confirmation
- Customer signature/acknowledgment

**Suggestion:** Add a "Project Handover" step between `installation_completed` and `completed` that generates a handover PDF and requires customer acknowledgment.

---

## 4. Unnecessary Steps / Friction Points

### FRICTION-1: Two-step "Accept then Convert" is redundant
**Current flow:** Accept quotation → Go to quotation detail → Click "Initialize Project" → Fill site address → Submit

The "Initialize Project" step requires re-entering the site address even though it's already on the customer record. The conversion form pre-fills from customer address/city, but this is a separate page load.

**Suggestion:** Allow "Convert to Project" directly from the quotation detail page as a modal, pre-filling all known data. Reduce to a single confirmation step.

---

### FRICTION-2: Payment form resets `paymentType` to "final" after submission
**File:** `src/app/(dashboard)/projects/[id]/project-detail-shell.tsx:393`

After recording a payment, the form resets `paymentType` to `"final"`. But most projects have multiple advance payments before the final one. Users must re-select "advance" each time.

**Suggestion:** Preserve the last-used `paymentType` in the form state.

---

### FRICTION-3: No bulk inventory consumption
**Impact:** Medium

When installing a solar system, technicians consume multiple items at once (panels, inverters, mounting hardware, cables). The current system requires consuming each item one-by-one through separate form submissions.

**Suggestion:** Add a "Bulk Consume" mode that accepts multiple line items in a single form.

---

### FRICTION-4: Quotation PDF export is a separate route, not a download
**File:** `src/app/(dashboard)/quotations/[id]/components/quote-detail-view.tsx:226`

The "Export PDF" button opens `/quotations/${id}/pdf` in a new tab. This is a full page load just to view a PDF. There is no "Download PDF" option.

**Suggestion:** Add a direct download button that triggers the PDF generation and downloads the file.

---

## 5. Summary of Recommended Fixes (Priority Order)

### Immediate (Bug Fixes) — ✅ ALL APPLIED
1. ✅ **BUG-1:** Added `revalidateTag(CACHE_TAGS.INVENTORY_LIST, "max")` + `revalidatePath("/inventory")` to `receivePurchaseOrder`
2. ✅ **BUG-2/7:** Added `revalidateTag(CACHE_TAGS.INVENTORY_LIST, "max")` + `revalidatePath("/inventory")` to `deleteProjectCost`
3. ✅ **BUG-3:** Removed `itemId` from `addProjectCostSchema`; hardcoded `itemId: null` in the insert
4. ✅ **BUG-4:** Removed "Edit Quote" button for `sent` quotations (was linking to non-existent `/edit` route); only `draft` quotations show the Edit button now
5. ✅ **BUG-5:** Added linked-project guard to `updateQuotation` — blocks edits once a project is created from the quote
6. ✅ **BUG-6:** Changed `amount` validation from `z.number().min(0.01)` to `z.number().int().min(1)` in `addProjectCostSchema`
7. ✅ **BUG-8:** Added `revalidateTag(CACHE_TAGS.PROJECTS_LIST, "max")` to all project-mutating actions (convert, update, markComplete, addCost, consumeInventory, deleteCost)
8. ✅ **FRICTION-2:** Removed `paymentType: "final"` reset after payment submission — preserves last-used type

### Short-term (Workflow Improvements)
7. **GAP-1:** Partial PO receipt support
8. **GAP-6:** Post-completion invoice creation CTA
9. **FRICTION-1:** Inline project conversion modal
10. **FRICTION-2:** Preserve payment type after submission
11. **FRICTION-3:** Bulk inventory consumption

### Medium-term (Real-World Features)
12. **GAP-2:** Quotation revision history
13. **GAP-3:** Deposit tracking and enforcement
14. **GAP-5:** Change order workflow
15. **GAP-7:** Project handover document

### Long-term (Operational Excellence)
16. **GAP-4:** Installation team assignment and checklist
17. **BUG-8:** Consistent cache tag usage across all entities
