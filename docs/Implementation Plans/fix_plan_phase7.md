## Phase 7 — 🧪 Testing Strategy

> **Goal**: Cover all critical paths with automated tests; create one master E2E-like integration test file.

### 7.1 — Unit/Integration Tests for Individual Components

- [ ] **Auth action tests** — `src/actions/__tests__/auth-actions.test.ts`
  - Login with valid/invalid credentials
  - Rate limit triggers after N failures
  - iron-session cookie is encrypted (not raw session_id)
  - Password change → old sessions revoked

- [ ] **Auth boundary tests** — `src/actions/__tests__/auth-boundary.test.ts`
  - All server actions reject unauthenticated calls
  - Authenticated user can access all features (no artificial RBAC blocks)

- [ ] **Quotation lifecycle tests** — `src/actions/__tests__/quotation-actions.test.ts`
  - Create → valid quote number generated
  - Status transitions: only valid transitions allowed
  - Accepted quote + linked project → cannot reopen to draft
  - Concurrent creation → no duplicate quote numbers

- [ ] **Project conversion tests** — `src/actions/__tests__/project-actions.test.ts`
  - Convert accepted quote → project created
  - Convert same quote twice concurrently → only one project (unique constraint)
  - Mark completed → warranty alerts created (exactly once, idempotent)

- [ ] **Notification dedup tests** — `src/actions/__tests__/notification-actions.test.ts`
  - Run scheduled checks twice → no duplicate notifications

- [ ] **Validation tests** — `src/actions/__tests__/validation.test.ts`
  - All filter inputs: malformed → rejected by Zod
  - UUID params: invalid format → rejected
  - Settings keys: only allowed keys accepted

### 7.2 — PWA / Deployment Smoke Tests

- [ ] **PWA manifest test** — `src/__tests__/pwa.test.ts`
  - Manifest route resolves at `/manifest.webmanifest`
  - All icon paths in manifest exist in `public/`
  - Service worker file is emitted in build output

- [ ] **API route tests** — `src/__tests__/api-routes.test.ts`
  - `/api/upload`: rejects unauthenticated, rejects oversized files, rejects wrong MIME types
  - `/quotations/[id]/pdf`: returns valid PDF content-type, rejects unauthorized

---

### 7.3 — 🏆 Master End-to-End Integration Test File

> This is the single "စစ်ဆေးရေး ဒရွတ်တိုက်" file — walks through the **entire business workflow** from login to completion, collecting errors along the way.

**File**: `src/__tests__/full-workflow-e2e.test.ts`

**Purpose**: Simulates the complete BOB Solar daily workflow as a single sequential test suite. If any step fails, all subsequent steps that depend on it should also fail, clearly showing where the chain breaks.

```
Test Suite: "Full BOB Solar Workflow — End-to-End"

describe("Phase 1: Authentication")
  ✓ User login with valid credentials → iron-session cookie set
  ✓ Invalid credentials → proper error (no stack trace leak)
  ✓ Rate limit → blocked after N attempts
  ✓ Unauthenticated request → rejected on all actions

describe("Phase 2: Company Setup")
  ✓ Any authenticated user updates company settings → success
  ✓ Unauthenticated attempt → rejected
  ✓ Upload logo → success (within size limit)
  ✓ Upload oversized file → rejected with clear error

describe("Phase 3: Inventory Management")
  ✓ Create inventory items (solar panels, inverters, batteries)
  ✓ List inventory with pagination → correct page size
  ✓ All 3 users can read/write inventory equally

describe("Phase 4: Customer Management")
  ✓ Create customer with valid data → success
  ✓ Create customer with invalid data → Zod validation error
  ✓ List customers with filters → correct results
  ✓ List with malformed filter → rejected by Zod
  ✓ Pagination works correctly

describe("Phase 5: Quotation Lifecycle")
  ✓ Create quotation for customer → unique quote number
  ✓ Create two quotations concurrently → no number collision
  ✓ Pricing calculation → matches engine output
  ✓ Send quotation (draft → sent) → status updated
  ✓ Invalid transition (draft → accepted) → rejected
  ✓ Accept quotation (sent → accepted) → status updated
  ✓ PDF generation → returns valid response

describe("Phase 6: Quote → Project Conversion")
  ✓ Convert accepted quote → project created with correct data
  ✓ Convert same quote again → rejected (unique constraint)
  ✓ Reopen converted quote (accepted → draft) → rejected
  ✓ Concurrent conversion attempts → only one succeeds

describe("Phase 7: Project Lifecycle")
  ✓ Update project status → success
  ✓ Add project costs → budget tracking correct
  ✓ Delete project cost → recalculated
  ✓ Add project remarks → stored
  ✓ Mark project completed → success
  ✓ Warranty alerts created (exactly 3 defaults)
  ✓ Mark completed again → idempotent (no duplicate alerts)

describe("Phase 8: Warranty & Notifications")
  ✓ Warranty alerts exist for completed project
  ✓ Resolve warranty alert → success
  ✓ Reopen warranty alert → success
  ✓ Run scheduled notification checks → notifications created
  ✓ Run scheduled checks again → no duplicates

describe("Phase 9: Dashboard Data")
  ✓ Dashboard stats return correct counts
  ✓ Conversion rate formula correct (not >100%)
  ✓ Pipeline data matches created quotes/projects
  ✓ Recent activity includes our test data

describe("Phase 10: Session & Password Security")
  ✓ Change password → old sessions invalidated
  ✓ Login with old password → fails
  ✓ Login with new password → succeeds
  ✓ Reset another user's password → crypto-safe temp password
  ✓ Session cookie is iron-session encrypted (not raw session_id)

describe("Phase 11: PWA & Deployment Checks")
  ✓ Manifest resolves at /manifest.webmanifest
  ✓ All manifest icon paths exist in public/
  ✓ Required font files exist in public/
  ✓ Build completes without errors
  ✓ No dotenv loading in runtime modules
```

> [!TIP]
> This test file should use a **separate Neon branch** as the test database. Each `describe` block builds on the previous — simulating a real user's daily journey through the app.

> [!IMPORTANT]
> **Implementation approach**: Use Vitest with direct server action imports (not HTTP calls) against a dedicated Neon test branch. This keeps tests fast while exercising real business logic. Set `DATABASE_URL` to the test branch URL in the test env.

---