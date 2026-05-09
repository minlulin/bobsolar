# BOB Solar — Progress Log Part 3: Projects & Warranty

> **Phase 3 — Active Projects, Completed Projects, Warranty & File Upload**
> Target: Week 6–7

---

## 3.1 Project Validators

### 3.1.1 Project Validators (`src/lib/validators/project.ts`)

- [x] `convertToProjectSchema`:
  - [x] `quotationId` — uuid, required
  - [x] `siteAddress` — string, optional (defaults from customer address)
  - [x] `systemSizeKwp` — number, optional
  - [x] `startDate` — date, optional
  - [x] `targetCompletion` — date, optional
  - [x] `notes` — string, optional
- [x] `updateProjectSchema`:
  - [x] `id` — uuid
  - [x] `status` — enum (planning/in_progress/on_hold/completed/cancelled)
  - [x] `siteAddress`, `systemSizeKwp`, `targetCompletion`, `notes` — optional
- [x] `addProjectCostSchema`:
  - [x] `projectId` — uuid
  - [x] `itemId` — uuid, optional (for ad-hoc costs without inventory item)
  - [x] `description` — string, required
  - [x] `amount` — number, min 0
  - [x] `costType` — enum (material/labor/transport/misc)
  - [x] `incurredDate` — date
- [x] `addProjectRemarkSchema`:
  - [x] `projectId` — uuid
  - [x] `content` — string, min 1
  - [x] `remarkType` — enum (note/issue/update)
- [x] `createWarrantyAlertSchema`:
  - [x] `projectId` — uuid
  - [x] `alertType` — enum (warranty_expiry/maintenance_due/follow_up)
  - [x] `description` — string
  - [x] `dueDate` — date
- [x] Export all inferred types

---

## 3.2 Active Projects Management

### 3.2.1 Server Actions (`src/actions/project-actions.ts`)

- [x] `convertQuotationToProject(data)`:
  - [x] Validate quotation status is `accepted`
  - [x] Generate project number: `PJ-{YEAR}-{SEQ}` (e.g., `PJ-2026-0001`)
  - [x] Create project record:
    - [x] Link `quotationId`, `customerId`
    - [x] Set `quotedTotal` from quotation total
    - [x] Set `status: 'planning'`
    - [x] Copy customer address as `siteAddress` default
  - [x] Update quotation status indicator (mark as converted)
  - [x] Return created project
- [x] `getProjects(filters?)`:
  - [x] Filter by status (active = planning/in_progress/on_hold)
  - [x] Join customer name, quotation number
  - [x] Include cost summary (total actual spend)
  - [x] Order by start_date or created_at
  - [x] Pagination
- [x] `getProject(id)`:
  - [x] Full project with all relations:
    - [x] Customer details
    - [x] Original quotation summary
    - [x] All costs with running total
    - [x] All remarks ordered by date
    - [x] Warranty alerts
  - [x] Calculate: `actualTotal` = sum of all project costs
  - [x] Calculate: budget variance = `actualTotal - quotedTotal`
- [x] `updateProject(id, data)`:
  - [x] Validate status transitions:
    - [x] `planning` → `in_progress` | `on_hold` | `cancelled`
    - [x] `in_progress` → `on_hold` | `completed` | `cancelled`
    - [x] `on_hold` → `in_progress` | `cancelled`
    - [x] `completed` → (no changes)
    - [x] `cancelled` → `planning` (reopen)
  - [x] If completing: set `actualCompletion` to today, calculate final `actualTotal`
- [x] `addProjectCost(data)`:
  - [x] Validate project is not completed/cancelled
  - [x] Insert cost record
  - [x] Recalculate project `actualTotal`
  - [x] If exceeds `quotedTotal` by >10% → create notification
  - [x] Return updated cost list
- [x] `deleteProjectCost(costId)`:
  - [x] Remove cost, recalculate `actualTotal`
- [x] `addProjectRemark(data)`:
  - [x] Insert remark with author info
  - [x] Return updated remarks list
- [x] `deleteProjectRemark(remarkId)`:
  - [x] Only author or admin can delete
- [x] `markProjectCompleted(id)`:
  - [x] Set status to `completed`
  - [x] Set `actualCompletion` = today
  - [x] Finalize `actualTotal`
  - [x] Auto-create default warranty alerts:
    - [x] "Panel Warranty Check" — due in 1 year
    - [x] "Inverter Warranty Check" — due in 1 year
    - [x] "System Maintenance" — due in 6 months
  - [x] Create notification: "Project {number} completed!"

### 3.2.2 TanStack Query Hooks (`src/hooks/use-projects.ts`)

- [x] `useProjects(filters)` — queryKey: `['projects', filters]`, stale: 30s
- [x] `useProject(id)` — single with all relations
- [x] `useConvertToProject()` — mutation
- [x] `useUpdateProject()` — mutation (invalidate on success)
- [x] `useAddProjectCost()` — mutation, invalidate project detail
- [x] `useDeleteProjectCost()` — mutation
- [x] `useAddProjectRemark()` — mutation, invalidate project detail
- [x] `useMarkProjectCompleted()` — mutation

### 3.2.3 Project List Page (`src/app/(dashboard)/projects/page.tsx`)

- [x] Page header: "Active Projects" with count
- [x] **Status filter pills:**
  - [x] All Active | Planning | In Progress | On Hold
  - [x] Active pill has energy glow
- [x] **Project cards (grid layout):**
  - [x] Project number (`PJ-2026-0001`) — bold
  - [x] Customer name
  - [x] System size badge (`5.5 kWp`)
  - [x] Status pill with color:
    - [x] Planning: indigo
    - [x] In Progress: emerald (animated pulse)
    - [x] On Hold: amber
  - [x] Progress indicator:
    - [x] Budget bar: `actualTotal / quotedTotal` as percentage
    - [x] Color: green (<80%), yellow (80-100%), red (>100%)
  - [x] Timeline: `Start → Target` date range
  - [x] Quick action: View detail
- [x] Cards with staggered entrance
- [x] Empty state: "No active projects. Accept a quotation to start."
- [x] Loading skeletons

### 3.2.4 Project Detail Page (`src/app/(dashboard)/projects/[id]/page.tsx`)

- [x] **Header:**
  - [x] Project number + status badge
  - [x] Customer name (link to customer detail)
  - [x] System size
  - [x] Status change dropdown (admin only)
  - [x] "Mark Completed" button (prominent, emerald gradient)

- [x] **Horizontal Timeline (`src/components/project/project-timeline.tsx`):**
  - [x] Visual phase indicators: Planning → In Progress → Completed
  - [x] Current phase highlighted with glow
  - [x] Dates shown below each phase
  - [x] Animated progress line

- [x] **Tab Panels:**
  - [x] **Overview Tab:**
    - [x] Site address
    - [x] Start date → Target completion
    - [x] Original quotation link (clickable → opens quote detail)
    - [x] Notes (editable inline)
    - [x] Key metrics cards:
      - [x] Quoted Total
      - [x] Actual Spend
      - [x] Variance (color-coded)

  - [x] **Costs Tab (`src/components/project/cost-tracker.tsx`):**
    - [x] "Add Cost" button
    - [x] Cost type filter tabs: All | Material | Labor | Transport | Misc
    - [x] **Budget visualization:**
      - [x] Horizontal stacked bar: Quoted vs Actual
      - [x] Breakdown by cost type (color segments)
    - [x] **Cost list:**
      - [x] Date | Description | Type badge | Amount (MMK)
      - [x] Delete button per row
      - [x] Running total at bottom
    - [x] **Add Cost Sheet/Dialog:**
      - [x] Description input
      - [x] Amount input (MMK)
      - [x] Cost type selector
      - [x] Date picker
      - [x] Optional: link to inventory item
      - [x] React Hook Form + Zod validation

  - [x] **Remarks Tab:**
    - [x] **Add Remark form:**
      - [x] Textarea with markdown-lite support
      - [x] Remark type selector (Note / Issue / Update)
      - [x] "Post" button
    - [x] **Remarks timeline:**
      - [x] Chronological order (newest first)
      - [x] Author avatar + name + timestamp
      - [x] Remark type icon/badge
      - [x] Content text
      - [x] Delete button (own remarks or admin)
    - [x] Staggered entrance animation

  - [x] **Warranty Tab:**
    - [x] Shows warranty alerts linked to this project
    - [x] "Add Alert" button
    - [x] Alert cards: type, description, due date, resolved status
    - [x] Mark as resolved toggle

---

## 3.3 Completed Projects & Warranty

### 3.3.1 Completed Projects Page (`src/app/(dashboard)/projects/completed/page.tsx`)

- [x] Page header: "Completed Projects" with count
- [x] **Search & filter:**
  - [x] Search by project number, customer name
  - [ ] Date range filter (completion date)
  - [x] Year selector
- [x] **Project history cards:**
  - [x] Project number + customer name
  - [x] Completion date
  - [x] System size
  - [x] Final cost vs quoted (with variance %)
  - [x] Warranty status indicators:
    - [x] 🟢 All OK (no upcoming alerts)
    - [x] 🟡 Alert Due Soon (within 30 days)
    - [x] 🔴 Overdue Alert
  - [x] Click → opens project detail page (read-only for completed)
- [x] Sorted by completion date (newest first)

### 3.3.2 Warranty & Aftersales Alerts

#### Server Actions

- [x] `getWarrantyAlerts(filters?)`:
  - [x] Filter: upcoming (next 30 days), overdue, all, resolved
  - [x] Join project + customer data
  - [x] Order by due_date ASC
- [x] `createWarrantyAlert(data)`:
  - [x] Validate with Zod
  - [x] Insert alert
  - [x] Create notification for all users
- [x] `resolveWarrantyAlert(id)`:
  - [x] Set `isResolved: true`
  - [x] Create notification: "Warranty alert resolved for {project}"
- [x] `reopenWarrantyAlert(id)`:
  - [x] Set `isResolved: false`

#### Warranty Page (`src/app/(dashboard)/warranty/page.tsx`)

- [x] Page header: "Warranty & Aftersales"
- [x] **Alert summary cards (top):**
  - [x] 🔴 Overdue count
  - [x] 🟡 Due This Month count
  - [x] 🟢 Upcoming count
  - [x] 📋 Total Active count
- [x] **Filter tabs:**
  - [x] Overdue | Due Soon | Upcoming | Resolved
- [x] **Alert list:**
  - [x] Alert type icon + badge
  - [x] Project number (link to project)
  - [x] Customer name
  - [x] Description
  - [x] Due date (with relative: "3 days overdue", "in 2 weeks")
  - [x] Due date color: red (overdue), amber (within 30 days), green (future)
  - [x] "Resolve" button → marks as handled
- [x] Staggered entrance animation
- [x] Empty state per filter

---

## 3.4 File Upload System (Vercel Blob)

### 3.4.1 Vercel Blob Configuration

- [x] Install `@vercel/blob` (already in dependencies)
- [ ] Obtain `BLOB_READ_WRITE_TOKEN` from Vercel dashboard
- [ ] Store in `.env.local`: `BLOB_READ_WRITE_TOKEN`
- [x] Note: Vercel Blob works locally via the token — no emulation needed

### 3.4.2 Blob Upload Helpers (`src/lib/storage/blob.ts`)

- [x] `uploadFile(file: File, folder: string): Promise<string>`:
  - [x] Upload to Vercel Blob with `put()`
  - [x] Key pattern: `{folder}/{uuid}-{filename}`
  - [x] Set `access: 'public'`
  - [x] Return public URL
- [x] `deleteFile(url: string): Promise<void>`:
  - [x] Delete blob by URL with `del()`

### 3.4.3 Upload API Route (`src/app/api/upload/route.ts`)

- [x] POST endpoint — authenticated
- [x] Accept `FormData` with `file` and `folder` fields
- [x] Validate content type (images only: jpeg, png, webp)
- [x] Validate file size limit (5MB max)
- [x] Upload to Vercel Blob
- [x] Return `{ url: string }`

### 3.4.4 Upload Component (`src/components/shared/file-upload.tsx`)

- [x] Drag-and-drop zone with visual feedback
- [x] Click to browse files
- [x] Image preview before upload
- [x] Progress indicator during upload
- [x] Success state: show uploaded image thumbnail
- [x] Error handling: file too large, wrong format
- [x] Reusable across:
  - [x] Company logo (settings)
  - [x] Project photos (future)

### 3.4.5 Company Logo Upload

- [x] In Settings page: "Company Logo" section
- [x] Upload component instance for logo
- [x] On upload success: update `companySettings` table with Blob URL
- [x] Logo appears in:
  - [x] PDF header
  - [ ] App header (optional)
  - [ ] Login page

---

## Part 3 Completion Criteria

- [x] Accepted quotation can be converted to a project
- [x] Project status transitions work correctly
- [x] Extra costs can be added/deleted with real-time total updates
- [x] Remarks can be posted and displayed chronologically
- [x] Budget visualization shows quoted vs actual spend
- [x] Mark completed creates default warranty alerts
- [x] Completed projects list with warranty status indicators
- [x] Warranty alerts page with filter/resolve workflow
- [x] Overdue alerts are visually prominent
- [x] Vercel Blob upload works end-to-end
- [x] Company logo uploads and appears in PDF
- [x] All pages responsive (mobile + desktop)
- [x] All loading/empty/error states implemented
