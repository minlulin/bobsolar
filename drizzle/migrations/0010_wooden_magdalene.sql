CREATE TABLE IF NOT EXISTS "auth_rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp,
	"last_attempt_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "archived_at" timestamp;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "is_archived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "archived_at" timestamp;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_rate_limits_locked_until_idx" ON "auth_rate_limits" USING btree ("locked_until");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_costs_project_id_idx" ON "project_costs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_costs_incurred_date_idx" ON "project_costs" USING btree ("incurred_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_remarks_project_id_idx" ON "project_remarks" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quotation_items_quotation_id_idx" ON "quotation_items" USING btree ("quotation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quotations_archived_status_created_at_idx" ON "quotations" USING btree ("is_archived","status","created_at");