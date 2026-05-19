Quick Plan (Remaining Work)

Lock RBAC policy (15 min)
Choose final rule:
owner/admin-only everywhere (recommended with your 3-owner model)
Then update docs to match runtime behavior exactly.
One-time user role cleanup (10 min)
Promote any existing staff users to admin so all 3 owners have full access.

Add auth lockout tests (30-45 min)
Test cases:

lock after max failed attempts
block during lock window
unlock/reset after successful login
Inventory usage -> project expense flow (2-4 hrs)
Implement project-side “consume inventory” action that:
reduces stock
creates project cost
posts journal entry
links to project for profitability
Completed project profitability view (2-3 hrs)
Show per completed project:
quoted revenue
received payment
inventory-consumed cost
additional costs
net profit
Final SSoT + audit doc sync (30-45 min)
Update:
docs/finance_system_ProgressLog.md
docs/strict-ts-biome-lefthook-finance-plan.md (if needed)
docs/Audit_Reports.md with closed/open items
Final verify gate (20-30 min)
Run:
pnpm lint
pnpm typecheck
pnpm test
pnpm build