CREATE TYPE "public"."project_invoice_status" AS ENUM('draft', 'unpaid', 'partial', 'paid', 'voided');--> statement-breakpoint
ALTER TYPE "public"."journal_source_type" ADD VALUE 'project_invoice';--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_code" text NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"budget_amount" numeric(15, 2) NOT NULL,
	"notes" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "budgets_account_period_unique" UNIQUE("account_code","period_start","period_end")
);
--> statement-breakpoint
CREATE TABLE "project_invoice_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(12, 2) NOT NULL,
	"unit_price" numeric(15, 2) NOT NULL,
	"tax_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"line_total" numeric(15, 2) NOT NULL,
	"sort_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"invoice_number" text NOT NULL,
	"invoice_date" timestamp NOT NULL,
	"due_date" timestamp NOT NULL,
	"status" "project_invoice_status" DEFAULT 'draft' NOT NULL,
	"subtotal" numeric(15, 2) NOT NULL,
	"tax_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"total" numeric(15, 2) NOT NULL,
	"paid_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"balance_due" numeric(15, 2) NOT NULL,
	"posted_entry_id" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "project_payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_costs" ADD COLUMN "is_reversed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "project_vouchers" ADD COLUMN "invoice_id" uuid;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_account_code_ledger_accounts_code_fk" FOREIGN KEY ("account_code") REFERENCES "public"."ledger_accounts"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_invoice_lines" ADD CONSTRAINT "project_invoice_lines_invoice_id_project_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."project_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_invoices" ADD CONSTRAINT "project_invoices_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_invoices" ADD CONSTRAINT "project_invoices_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_invoices" ADD CONSTRAINT "project_invoices_posted_entry_id_journal_entries_id_fk" FOREIGN KEY ("posted_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_invoices" ADD CONSTRAINT "project_invoices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_payment_allocations" ADD CONSTRAINT "project_payment_allocations_payment_id_project_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."project_payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_payment_allocations" ADD CONSTRAINT "project_payment_allocations_invoice_id_project_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."project_invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_invoice_lines_invoice_id_idx" ON "project_invoice_lines" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "project_invoices_project_id_idx" ON "project_invoices" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_invoices_customer_id_idx" ON "project_invoices" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "project_invoices_status_idx" ON "project_invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "project_invoices_due_date_idx" ON "project_invoices" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "project_payment_allocations_payment_id_idx" ON "project_payment_allocations" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "project_payment_allocations_invoice_id_idx" ON "project_payment_allocations" USING btree ("invoice_id");--> statement-breakpoint
ALTER TABLE "project_vouchers" ADD CONSTRAINT "project_vouchers_invoice_id_project_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."project_invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_stock_qty_non_negative" CHECK ("inventory_items"."stock_qty" >= 0);