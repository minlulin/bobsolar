CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customers_name_trgm_gin_idx"
ON "customers"
USING gin ("name" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customers_email_trgm_gin_idx"
ON "customers"
USING gin ("email" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_project_number_trgm_gin_idx"
ON "projects"
USING gin ("project_number" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_items_name_trgm_gin_idx"
ON "inventory_items"
USING gin ("name" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quotations_quote_number_trgm_gin_idx"
ON "quotations"
USING gin ("quote_number" gin_trgm_ops);
