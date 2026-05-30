CREATE TYPE "public"."accounting_period_status" AS ENUM('open', 'soft_closed', 'closed');--> statement-breakpoint
ALTER TYPE "public"."journal_source_type" ADD VALUE 'cash_transfer';--> statement-breakpoint
CREATE TABLE "accounting_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period_month" text NOT NULL,
	"status" "accounting_period_status" DEFAULT 'open' NOT NULL,
	"closed_by" uuid,
	"closed_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "accounting_periods_period_month_unique" UNIQUE("period_month")
);
--> statement-breakpoint
DROP INDEX "journal_entries_entry_date_idx";--> statement-breakpoint
DROP INDEX "journal_entries_is_reversed_idx";--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "bill_date" timestamp;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "due_date" timestamp;--> statement-breakpoint
ALTER TABLE "accounting_periods" ADD CONSTRAINT "accounting_periods_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "journal_entries_date_reversed_idx" ON "journal_entries" USING btree ("entry_date","is_reversed");