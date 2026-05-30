ALTER TABLE "quotations" ALTER COLUMN "discount_percent" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "quotations" ALTER COLUMN "discount_amount" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "quotations" ALTER COLUMN "tax_percent" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "quotations" ALTER COLUMN "tax_amount" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "quotation_items" ADD COLUMN "discount_percentage" numeric(5, 2) DEFAULT '0';