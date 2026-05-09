# BOB Solar — Progress Log Part 3: Projects & Warranty

> **Phase 3 — Active Projects, Completed Projects, Warranty & File Upload**
> Target: Week 6–7

---

## 3.1 Project Validators

### 3.1.1 Project Validators (`src/lib/validators/project.ts`)
- [ ] `convertToProjectSchema`:
  - [ ] `quotationId` — uuid, required
  - [ ] `siteAddress` — string, optional (defaults from customer address)
  - [ ] `systemSizeKwp` — number, optional
  - [ ] `startDate` — date, optional
  - [ ] `targetCompletion` — date, optional
  - [ ] `notes` — string, optional
- [ ] `updateProjectSchema`:
  - [ ] `id` — uuid
  - [ ] `status` — enum (planning/in_progress/on_hold/completed/cancelled)
  - [ ] `siteAddress`, `systemSizeKwp`, `targetCompletion`, `notes` — optional
- [ ] `addProjectCostSchema`:
  - [ ] `projectId` — uuid
  - [ ] `itemId` — uuid, optional (for ad-hoc costs without inventory item)
  - [ ] `description` — string, required
  - [ ] `amount` — number, min 0
  - [ ] `costType` — enum (material/labor/transport/misc)
  - [ ] `incurredDate` — date
- [ ] `addProjectRemarkSchema`:
  - [ ] `projectId` — uuid
  - [ ] `content` — string, min 1
  - [ ] `remarkType` — enum (note/issue/update)
- [ ] `createWarrantyAlertSchema`:
  - [ ] `projectId` — uuid
  - [ ] `alertType` — enum (warranty_expiry/maintenance_due/follow_up)
  - [ ] `description` — string
  - [ ] `dueDate` — date
- [ ] Export all inferred types

---

## 3.2 Active Projects Management

### 3.2.1 Server Actions (`src/actions/project-actions.ts`)
- [ ] `convertQuotationToProject(data)`:
  - [ ] Validate quotation status is `accepted`
  - [ ] Generate project number: `PJ-{YEAR}-{SEQ}` (e.g., `PJ-2026-0001`)
  - [ ] Create project record:
    - [ ] Link `quotationId`, `customerId`
    - [ ] Set `quotedTotal` from quotation total
    - [ ] Set `status: 'planning'`
    - [ ] Copy customer address as `siteAddress` default
  - [ ] Update quotation status indicator (mark as converted)
  - [ ] Return created project
- [ ] `getProjects(filters?)`:
  - [ ] Filter by status (active = planning/in_progress/on_hold)
  - [ ] Join customer name, quotation number
  - [ ] Include cost summary (total actual spend)
  - [ ] Order by start_date or created_at
  - [ ] Pagination
- [ ] `getProject(id)`:
  - [ ] Full project with all relations:
    - [ ] Customer details
    - [ ] Original quotation summary
    - [ ] All costs with running total
    - [ ] All remarks ordered by date
    - [ ] Warranty alerts
  - [ ] Calculate: `actualTotal` = sum of all project costs
  - [ ] Calculate: budget variance = `actualTotal - quotedTotal`
- [ ] `updateProject(id, data)`:
  - [ ] Validate status transitions:
    - [ ] `planning` → `in_progress` | `on_hold` | `cancelled`
    - [ ] `in_progress` → `on_hold` | `completed` | `cancelled`
    - [ ] `on_hold` → `in_progress` | `cancelled`
    - [ ] `completed` → (no changes)
    - [ ] `cancelled` → `planning` (reopen)
  - [ ] If completing: set `actualCompletion` to today, calculate final `actualTotal`
- [ ] `addProjectCost(data)`:
  - [ ] Validate project is not completed/cancelled
  - [ ] Insert cost record
  - [ ] Recalculate project `actualTotal`
  - [ ] If exceeds `quotedTotal` by >10% → create notification
  - [ ] Return updated cost list
- [ ] `deleteProjectCost(costId)`:
  - [ ] Remove cost, recalculate `actualTotal`
- [ ] `addProjectRemark(data)`:
  - [ ] Insert remark with author info
  - [ ] Return updated remarks list
- [ ] `deleteProjectRemark(remarkId)`:
  - [ ] Only author or admin can delete
- [ ] `markProjectCompleted(id)`:
  - [ ] Set status to `completed`
  - [ ] Set `actualCompletion` = today
  - [ ] Finalize `actualTotal`
  - [ ] Auto-create default warranty alerts:
    - [ ] "Panel Warranty Check" — due in 1 year
    - [ ] "Inverter Warranty Check" — due in 1 year
    - [ ] "System Maintenance" — due in 6 months
  - [ ] Create notification: "Project {number} completed!"

### 3.2.2 TanStack Query Hooks (`src/hooks/use-projects.ts`)
- [ ] `useProjects(filters)` — queryKey: `['projects', filters]`, stale: 30s
- [ ] `useProject(id)` — single with all relations
- [ ] `useConvertToProject()` — mutation
- [ ] `useUpdateProject()` — mutation + optimistic status
- [ ] `useAddProjectCost()` — mutation, invalidate project detail
- [ ] `useDeleteProjectCost()` — mutation
- [ ] `useAddProjectRemark()` — mutation, invalidate project detail
- [ ] `useMarkProjectCompleted()` — mutation

### 3.2.3 Project List Page (`src/app/(dashboard)/projects/page.tsx`)
- [ ] Page header: "Active Projects" with count
- [ ] **Status filter pills:**
  - [ ] All Active | Planning | In Progress | On Hold
  - [ ] Active pill has energy glow
- [ ] **Project cards (grid layout):**
  - [ ] Project number (`PJ-2026-0001`) — bold
  - [ ] Customer name
  - [ ] System size badge (`5.5 kWp`)
  - [ ] Status pill with color:
    - [ ] Planning: indigo
    - [ ] In Progress: emerald (animated pulse)
    - [ ] On Hold: amber
  - [ ] Progress indicator:
    - [ ] Budget bar: `actualTotal / quotedTotal` as percentage
    - [ ] Color: green (<80%), yellow (80-100%), red (>100%)
  - [ ] Timeline: `Start → Target` date range
  - [ ] Quick action: View detail
- [ ] Cards with staggered entrance
- [ ] Empty state: "No active projects. Accept a quotation to start."
- [ ] Loading skeletons

### 3.2.4 Project Detail Page (`src/app/(dashboard)/projects/[id]/page.tsx`)
- [ ] **Header:**
  - [ ] Project number + status badge
  - [ ] Customer name (link to customer detail)
  - [ ] System size
  - [ ] Status change dropdown (admin only)
  - [ ] "Mark Completed" button (prominent, emerald gradient)

- [ ] **Horizontal Timeline (`src/components/project/project-timeline.tsx`):**
  - [ ] Visual phase indicators: Planning → In Progress → Completed
  - [ ] Current phase highlighted with glow
  - [ ] Dates shown below each phase
  - [ ] Animated progress line

- [ ] **Tab Panels:**
  - [ ] **Overview Tab:**
    - [ ] Site address
    - [ ] Start date → Target completion
    - [ ] Original quotation link (clickable → opens quote detail)
    - [ ] Notes (editable inline)
    - [ ] Key metrics cards:
      - [ ] Quoted Total
      - [ ] Actual Spend
      - [ ] Variance (color-coded)

  - [ ] **Costs Tab (`src/components/project/cost-tracker.tsx`):**
    - [ ] "Add Cost" button
    - [ ] Cost type filter tabs: All | Material | Labor | Transport | Misc
    - [ ] **Budget visualization:**
      - [ ] Horizontal stacked bar: Quoted vs Actual
      - [ ] Breakdown by cost type (color segments)
    - [ ] **Cost list:**
      - [ ] Date | Description | Type badge | Amount (MMK)
      - [ ] Delete button per row
      - [ ] Running total at bottom
    - [ ] **Add Cost Sheet/Dialog:**
      - [ ] Description input
      - [ ] Amount input (MMK)
      - [ ] Cost type selector
      - [ ] Date picker
      - [ ] Optional: link to inventory item
      - [ ] React Hook Form + Zod validation

  - [ ] **Remarks Tab:**
    - [ ] **Add Remark form:**
      - [ ] Textarea with markdown-lite support
      - [ ] Remark type selector (Note / Issue / Update)
      - [ ] "Post" button
    - [ ] **Remarks timeline:**
      - [ ] Chronological order (newest first)
      - [ ] Author avatar + name + timestamp
      - [ ] Remark type icon/badge
      - [ ] Content text
      - [ ] Delete button (own remarks or admin)
    - [ ] Staggered entrance animation

  - [ ] **Warranty Tab:**
    - [ ] Shows warranty alerts linked to this project
    - [ ] "Add Alert" button
    - [ ] Alert cards: type, description, due date, resolved status
    - [ ] Mark as resolved toggle

---

## 3.3 Completed Projects & Warranty

### 3.3.1 Completed Projects Page (`src/app/(dashboard)/projects/completed/page.tsx`)
- [ ] Page header: "Completed Projects" with count
- [ ] **Search & filter:**
  - [ ] Search by project number, customer name
  - [ ] Date range filter (completion date)
  - [ ] Year selector
- [ ] **Project history cards:**
  - [ ] Project number + customer name
  - [ ] Completion date
  - [ ] System size
  - [ ] Final cost vs quoted (with variance %)
  - [ ] Warranty status indicators:
    - [ ] 🟢 All OK (no upcoming alerts)
    - [ ] 🟡 Alert Due Soon (within 30 days)
    - [ ] 🔴 Overdue Alert
  - [ ] Click → opens project detail page (read-only for completed)
- [ ] Sorted by completion date (newest first)

### 3.3.2 Warranty & Aftersales Alerts

#### Server Actions
- [ ] `getWarrantyAlerts(filters?)`:
  - [ ] Filter: upcoming (next 30 days), overdue, all, resolved
  - [ ] Join project + customer data
  - [ ] Order by due_date ASC
- [ ] `createWarrantyAlert(data)`:
  - [ ] Validate with Zod
  - [ ] Insert alert
  - [ ] Create notification for all users
- [ ] `resolveWarrantyAlert(id)`:
  - [ ] Set `isResolved: true`
  - [ ] Create notification: "Warranty alert resolved for {project}"
- [ ] `reopenWarrantyAlert(id)`:
  - [ ] Set `isResolved: false`

#### Warranty Page (`src/app/(dashboard)/warranty/page.tsx`)
- [ ] Page header: "Warranty & Aftersales"
- [ ] **Alert summary cards (top):**
  - [ ] 🔴 Overdue count
  - [ ] 🟡 Due This Month count
  - [ ] 🟢 Upcoming count
  - [ ] 📋 Total Active count
- [ ] **Filter tabs:**
  - [ ] Overdue | Due Soon | Upcoming | Resolved
- [ ] **Alert list:**
  - [ ] Alert type icon + badge
  - [ ] Project number (link to project)
  - [ ] Customer name
  - [ ] Description
  - [ ] Due date (with relative: "3 days overdue", "in 2 weeks")
  - [ ] Due date color: red (overdue), amber (within 30 days), green (future)
  - [ ] "Resolve" button → marks as handled
- [ ] Staggered entrance animation
- [ ] Empty state per filter

---

## 3.4 File Upload System (Cloudflare R2)

### 3.4.1 R2 Configuration
- [ ] Create R2 bucket: `bobsolar-files` in Cloudflare dashboard
- [ ] Generate R2 API token (Object Read & Write)
- [ ] Store credentials in `.env.local`:
  - [ ] `R2_ACCOUNT_ID`
  - [ ] `R2_ACCESS_KEY_ID`
  - [ ] `R2_SECRET_ACCESS_KEY`
  - [ ] `R2_BUCKET_NAME`
- [ ] Configure CORS on R2 bucket (allow PUT from app domain)

### 3.4.2 R2 Upload Helpers (`src/lib/storage/r2.ts`)
- [ ] Install: `pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`
- [ ] Create S3Client configured for R2 endpoint
- [ ] `generateUploadUrl(filename, contentType)`:
  - [ ] Generate unique key: `{folder}/{uuid}-{filename}`
  - [ ] Create presigned PutObject URL (expires: 10min)
  - [ ] Return: `{ uploadUrl, fileKey }`
- [ ] `getPublicUrl(fileKey)`:
  - [ ] Return public R2 URL or presigned GET URL
- [ ] `deleteFile(fileKey)`:
  - [ ] Delete object from R2

### 3.4.3 Upload API Route (`src/app/api/upload/route.ts`)
- [ ] POST endpoint — authenticated
- [ ] Accept: `{ filename, contentType, folder }` (folder = "logos" | "photos")
- [ ] Validate content type (images only: jpeg, png, webp)
- [ ] Validate file size limit (5MB max)
- [ ] Generate presigned URL
- [ ] Return `{ uploadUrl, fileKey }`

### 3.4.4 Upload Component (`src/components/shared/file-upload.tsx`)
- [ ] Drag-and-drop zone with visual feedback
- [ ] Click to browse files
- [ ] Image preview before upload
- [ ] Progress indicator during upload
- [ ] Success state: show uploaded image thumbnail
- [ ] Error handling: file too large, wrong format
- [ ] Reusable across:
  - [ ] Company logo (settings)
  - [ ] Project photos (future)

### 3.4.5 Company Logo Upload
- [ ] In Settings page: "Company Logo" section
- [ ] Upload component instance for logo
- [ ] On upload success: update `companySettings` table with R2 file key
- [ ] Logo appears in:
  - [ ] PDF header
  - [ ] App header (optional)
  - [ ] Login page

---

## Part 3 Completion Criteria
- [ ] Accepted quotation can be converted to a project
- [ ] Project status transitions work correctly
- [ ] Extra costs can be added/deleted with real-time total updates
- [ ] Remarks can be posted and displayed chronologically
- [ ] Budget visualization shows quoted vs actual spend
- [ ] Mark completed creates default warranty alerts
- [ ] Completed projects list with warranty status indicators
- [ ] Warranty alerts page with filter/resolve workflow
- [ ] Overdue alerts are visually prominent
- [ ] R2 file upload works end-to-end (presigned URL flow)
- [ ] Company logo uploads and appears in PDF
- [ ] All pages responsive (mobile + desktop)
- [ ] All loading/empty/error states implemented
