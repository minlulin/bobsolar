## Phase 7 — 🧪 Testing Strategy

> **Goal**: Cover all critical paths with automated tests; create one master E2E-like integration test file.

### 7.1 — Unit/Integration Tests for Individual Components

- [x] **Validation tests** — `src/lib/validators/__tests__/common.test.ts`, `src/lib/validators/__tests__/customer.test.ts`, `src/lib/validators/__tests__/quotation.test.ts`
  - UUID params: invalid format → rejected
  - Pagination schema defaults and bounds
  - Customer creation schema validation
  - Quotation creation and status update schema validation

- [x] **Domain tests** — `src/lib/domain/__tests__/enums.test.ts`
  - Enum values match Drizzle schema
  - Quotation status transitions (draft→sent, sent→accepted, etc.)
  - Project status transitions (planning→in_progress, completed blocked)
  - Type guards work correctly

### 7.2 — PWA / Deployment Smoke Tests

- [x] **PWA manifest test** — `src/__tests__/pwa.test.ts`
  - Manifest route file exists at `src/app/manifest.ts`
  - All icon files referenced in manifest exist in `public/`
  - Service worker file (`public/sw.js`) exists in build output
  - Font and icon directories exist in `public/`

---

### 7.3 — 🏆 Master End-to-End Integration Test File

- [x] **Master E2E file** — `src/__tests__/full-workflow-e2e.test.ts`
  - 19 tests covering 11 phases of the business workflow
  - Phase 1: Auth validation (loginSchema)
  - Phase 3: Pricing engine (line items, multi-item quotes, bulk pricing, MMK formatting)
  - Phase 4: Customer validation (required fields, filter defaults)
  - Phase 5: Quotation lifecycle (creation, status transitions, numbering)
  - Phase 6: Project number format validation
  - Phase 7: Project status transitions
  - Phase 8: Warranty types, integer math enforcement
  - Phase 9: Dashboard conversion rate formula
  - Phase 10: UUID input validation
  - Phase 11: No floating point in pricing engine

### 7.4 — Summary

- **Total test files**: 8
- **Total tests**: 103
- **All passing**: ✅
- **Coverage**: Pricing engine, validation schemas, domain enums/transitions, PWA assets, full workflow E2E
- **Remaining for full coverage**: Server Actions (require Next.js runtime mocking), DB integration tests (require test DB connection)

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
