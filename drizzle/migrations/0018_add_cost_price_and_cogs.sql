ALTER TYPE "public"."journal_source_type" ADD VALUE IF NOT EXISTS 'inventory_consumption' BEFORE 'manual_adjustment';--> statement-breakpoint
ALTER TABLE "inventory_items" ADD COLUMN IF NOT EXISTS "cost_price" numeric(15, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "estimated_cogs" numeric(15, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "quotation_items" ADD COLUMN IF NOT EXISTS "cost_price" numeric(15, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "quotation_items" ADD COLUMN IF NOT EXISTS "cost_total" numeric(15, 2) DEFAULT '0' NOT NULL;
