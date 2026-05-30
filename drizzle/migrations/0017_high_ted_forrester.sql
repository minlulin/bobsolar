ALTER TYPE "public"."project_status" ADD VALUE IF NOT EXISTS 'installation_completed' BEFORE 'completed';--> statement-breakpoint
ALTER TABLE "quotations" DROP CONSTRAINT IF EXISTS "quotations_customer_id_customers_id_fk";
--> statement-breakpoint
ALTER TABLE "inventory_items" ALTER COLUMN "unit_price" SET DATA TYPE numeric(15, 2);--> statement-breakpoint
ALTER TABLE "journal_lines" ALTER COLUMN "debit" SET DATA TYPE numeric(15, 2);--> statement-breakpoint
ALTER TABLE "journal_lines" ALTER COLUMN "debit" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "journal_lines" ALTER COLUMN "credit" SET DATA TYPE numeric(15, 2);--> statement-breakpoint
ALTER TABLE "journal_lines" ALTER COLUMN "credit" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "project_costs" ALTER COLUMN "amount" SET DATA TYPE numeric(15, 2);--> statement-breakpoint
ALTER TABLE "project_payments" ALTER COLUMN "amount" SET DATA TYPE numeric(15, 2);--> statement-breakpoint
ALTER TABLE "project_vouchers" ALTER COLUMN "total_amount" SET DATA TYPE numeric(15, 2);--> statement-breakpoint
ALTER TABLE "project_vouchers" ALTER COLUMN "paid_amount" SET DATA TYPE numeric(15, 2);--> statement-breakpoint
ALTER TABLE "project_vouchers" ALTER COLUMN "balance_amount" SET DATA TYPE numeric(15, 2);--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "quoted_total" SET DATA TYPE numeric(15, 2);--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "actual_total" SET DATA TYPE numeric(15, 2);--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "actual_total" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "quotation_items" ALTER COLUMN "unit_price" SET DATA TYPE numeric(15, 2);--> statement-breakpoint
ALTER TABLE "quotation_items" ALTER COLUMN "total_price" SET DATA TYPE numeric(15, 2);--> statement-breakpoint
ALTER TABLE "quotations" ALTER COLUMN "subtotal" SET DATA TYPE numeric(15, 2);--> statement-breakpoint
ALTER TABLE "quotations" ALTER COLUMN "discount_amount" SET DATA TYPE numeric(15, 2);--> statement-breakpoint
ALTER TABLE "quotations" ALTER COLUMN "discount_amount" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "quotations" ALTER COLUMN "tax_amount" SET DATA TYPE numeric(15, 2);--> statement-breakpoint
ALTER TABLE "quotations" ALTER COLUMN "tax_amount" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "quotations" ALTER COLUMN "total" SET DATA TYPE numeric(15, 2);--> statement-breakpoint
ALTER TABLE "project_costs" ADD COLUMN IF NOT EXISTS "payment_method_id" uuid;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'project_costs_payment_method_id_payment_methods_id_fk'
  ) THEN
    ALTER TABLE "project_costs"
      ADD CONSTRAINT "project_costs_payment_method_id_payment_methods_id_fk"
      FOREIGN KEY ("payment_method_id")
      REFERENCES "public"."payment_methods"("id")
      ON DELETE no action
      ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'quotations_customer_id_customers_id_fk'
  ) THEN
    ALTER TABLE "quotations"
      ADD CONSTRAINT "quotations_customer_id_customers_id_fk"
      FOREIGN KEY ("customer_id")
      REFERENCES "public"."customers"("id")
      ON DELETE restrict
      ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_costs_payment_method_id_idx" ON "project_costs" USING btree ("payment_method_id");
