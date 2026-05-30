-- Phase 7: Performance indexes for finance endpoints
-- Optimize high-volume query paths for ledger, dashboard, and reports

-- Journal entries: composite index for date + source type filtering (dashboard, reports)
CREATE INDEX IF NOT EXISTS "journal_entries_date_source_type_idx" ON "journal_entries" USING btree ("entry_date", "source_type");

-- Journal entries: composite index for date + reversed status (exclude reversed from reports)
CREATE INDEX IF NOT EXISTS "journal_entries_date_reversed_idx" ON "journal_entries" USING btree ("entry_date", "is_reversed");

-- Journal lines: composite index for entry + account (ledger detail lookups)
CREATE INDEX IF NOT EXISTS "journal_lines_entry_account_idx" ON "journal_lines" USING btree ("entry_id", "account_id");

-- Journal lines: index for project filtering (project-level reports)
CREATE INDEX IF NOT EXISTS "journal_lines_project_idx" ON "journal_lines" USING btree ("project_id") WHERE "project_id" IS NOT NULL;

-- Project payments: index for payment date range queries (cash movement report)
CREATE INDEX IF NOT EXISTS "project_payments_date_method_idx" ON "project_payments" USING btree ("payment_date", "payment_method_id");

-- Project costs: index for incurred date + cost type (expense reports)
CREATE INDEX IF NOT EXISTS "project_costs_date_type_idx" ON "project_costs" USING btree ("incurred_date", "cost_type");

-- Ledger accounts: index for active accounts only (most queries filter active)
CREATE INDEX IF NOT EXISTS "ledger_accounts_active_idx" ON "ledger_accounts" USING btree ("is_active") WHERE "is_active" = true;
