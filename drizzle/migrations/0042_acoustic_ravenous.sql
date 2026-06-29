CREATE TYPE "public"."change_order_status" AS ENUM('draft', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
ALTER TYPE "public"."journal_source_type" ADD VALUE 'project_change_order';--> statement-breakpoint
CREATE TABLE "project_change_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"change_order_id" uuid NOT NULL,
	"item_id" uuid,
	"description" text NOT NULL,
	"quantity" numeric(12, 2) NOT NULL,
	"unit_price" numeric(15, 2) NOT NULL,
	"total_price" numeric(15, 2) NOT NULL,
	"is_addition" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_change_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"change_order_number" text NOT NULL,
	"status" "change_order_status" DEFAULT 'draft' NOT NULL,
	"description" text NOT NULL,
	"additional_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"original_quotation_id" uuid,
	"approved_by" uuid,
	"approved_at" timestamp,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_change_orders_change_order_number_unique" UNIQUE("change_order_number")
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "deposit_required" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "deposit_amount" numeric(15, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "deposit_received" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "handover_date" timestamp;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "handover_acknowledged_by" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "handover_acknowledged_at" timestamp;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "handover_pdf_url" text;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD COLUMN "received_quantity" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "quotation_date" timestamp;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "revision_number" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "original_quotation_id" uuid;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "revision_reason" text;--> statement-breakpoint
ALTER TABLE "project_change_order_items" ADD CONSTRAINT "project_change_order_items_change_order_id_project_change_orders_id_fk" FOREIGN KEY ("change_order_id") REFERENCES "public"."project_change_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_change_order_items" ADD CONSTRAINT "project_change_order_items_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_change_orders" ADD CONSTRAINT "project_change_orders_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_change_orders" ADD CONSTRAINT "project_change_orders_original_quotation_id_quotations_id_fk" FOREIGN KEY ("original_quotation_id") REFERENCES "public"."quotations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_change_orders" ADD CONSTRAINT "project_change_orders_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_change_orders" ADD CONSTRAINT "project_change_orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_change_order_items_change_order_id_idx" ON "project_change_order_items" USING btree ("change_order_id");--> statement-breakpoint
CREATE INDEX "project_change_orders_project_id_idx" ON "project_change_orders" USING btree ("project_id");--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_original_quotation_id_quotations_id_fk" FOREIGN KEY ("original_quotation_id") REFERENCES "public"."quotations"("id") ON DELETE cascade ON UPDATE no action;