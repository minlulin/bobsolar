# DB SSoT Audit (Main Workspace)

Date: 2026-05-23
Workspace: C:/bobsolar
Source of Truth decision: **this workspace (schema.ts + drizzle/migrations) is authoritative**

## 1) Git Tracking Guard
- Updated .gitignore to stop broad SQL loss and always track Drizzle migrations.
- Rule now explicitly keeps: `drizzle/migrations/**/*.sql`

## 2) Migration Journal Integrity
- Local migration files found: **20**
- DB migration rows found: **20**
- Result after reconciliation: **all local migration hashes match DB journal by created_at**

### File-by-file migration check (one by one)
| Migration | SQL Statements | Present in DB Journal | Hash Match |
|---|---:|---|---|
| 0000_reflective_vanisher | 35 | yes | yes |
| 0001_soft_enchantress | 6 | yes | yes |
| 0002_quick_exodus | 1 | yes | yes |
| 0003_clever_avengers | 1 | yes | yes |
| 0004_flashy_gressill | 1 | yes | yes |
| 0005_operational-indexes | 11 | yes | yes |
| 0006_inventory-specifications | 1 | yes | yes |
| 0007_auth-rate-limits-and-customer-archive | 3 | yes | yes |
| 0008_trgm-search-indexes | 6 | yes | yes |
| 0009_quotation-archive | 1 | yes | yes |
| 0010_wooden_magdalene | 10 | yes | yes |
| 0011_notifications-dedupe-unique | 1 | yes | yes |
| 0012_add_voucher_payment_tables | 15 | yes | yes |
| 0013_same_inhumans | 17 | yes | yes |
| 0014_large_doctor_octopus | 4 | yes | yes |
| 0015_finance-performance-indexes | 1 | yes | yes |
| 0016_project-installation-stage | 1 | yes | yes |
| 0017_high_ted_forrester | 27 | yes | yes |
| 0018_add_cost_price_and_cogs | 5 | yes | yes |
| 0019_add_general_cost_type | 1 | yes | yes |

## 3) Public Schema Inventory
- Tables in DB: **19**
- Enums in DB: **12**

### Tables
- auth_rate_limits
- company_settings
- customers
- inventory_items
- journal_entries
- journal_lines
- ledger_accounts
- notifications
- payment_methods
- project_costs
- project_payments
- project_remarks
- project_vouchers
- projects
- quotation_items
- quotations
- sessions
- users
- warranty_alerts

### Enums
- alert_type: {warranty_expiry,maintenance_due,follow_up}
- cost_type: {material,labor,transport,misc,general}
- inventory_category: {panel,inverter,battery,mounting,cable,accessory,labor}
- inventory_unit: {pcs,meter,set,kWp,job}
- journal_source_type: {project_payment,project_expense,inventory_consumption,manual_adjustment,opening_balance,backfill}
- ledger_account_type: {asset,liability,equity,income,expense}
- notification_type: {info,warning,action}
- project_status: {planning,in_progress,on_hold,installation_completed,completed,cancelled}
- quotation_status: {draft,sent,accepted,rejected,expired}
- remark_type: {note,issue,update}
- user_role: {admin,staff}
- voucher_type: {completion_certificate,final_payment_voucher}

## 4) Critical Drift Findings and Enforcement
- Fixed migration replay fragility in:
  - `0017_high_ted_forrester.sql` (idempotent enum/column/constraint/index handling)
  - `0018_add_cost_price_and_cogs.sql` (idempotent enum/column adds)
  - `0019_add_general_cost_type.sql` (added `general` to DB enum)
- Reconciled DB journal hash drift for created_at values:
  - 1778600000000
  - 1778601000000
  - 1778602000000
  - 1778602790508

### May 2026 Logical Safety and Metric Alignments
- **Accounting Metric Realignment (SSoT Metric Drift)**:
  - Month-End report totals (`totalIncome` / `totalExpense`) and Dashboard finance summaries now strictly calculate accrual-basis revenue and expense from ledger accounts of type `"income"` and `"expense"` (instead of mapping cash collections).
  - Quick View Cash flow card now computes debits/credits specifically on cash-representing asset accounts (`cash_on_hand`, bank account, and e-wallets) to reflect actual cash movements (excluding non-cash COGS consumption).
- **Concurrency Locking for Project Sequences**:
  - Implemented Postgres-native transaction-scoped advisory locks via `pg_try_advisory_xact_lock` using key `0x50_52_4f_4a` (`1347571530n`) during quote-to-project conversions to prevent duplicate project sequence generation.
- **Referential Integrity for Customer Archiving**:
  - Added guards to customer archiving (`deleteCustomer`) to block archiving operations when active quotations or projects exist for the target customer, mimicking relational safety constraints.

## 5) Runtime Safety Notes
- `pnpm db:migrate` now succeeds in this workspace.
- Runtime uses pooled URL; migrations use direct URL.

## 6) Operational SSoT Rules (Enforced)
1. Only this workspace generates/edits migration SQL.
2. Always commit:
   - `drizzle/migrations/*.sql`
   - `drizzle/migrations/meta/_journal.json`
3. Never use broad SQL ignore rules that hide migrations from Git.
4. Home/office agents must pull latest before any DB-affecting change.
