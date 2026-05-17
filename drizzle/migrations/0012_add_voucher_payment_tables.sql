CREATE TYPE "public"."voucher_type" AS ENUM('completion_certificate', 'final_payment_voucher');--> statement-breakpoint
CREATE TABLE "payment_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"voucher_id" uuid,
	"amount" numeric(15, 0) NOT NULL,
	"payment_method_id" uuid NOT NULL,
	"payment_date" timestamp DEFAULT now() NOT NULL,
	"reference" text,
	"notes" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_vouchers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"voucher_number" text NOT NULL,
	"voucher_type" "voucher_type" NOT NULL,
	"issued_at" timestamp DEFAULT now() NOT NULL,
	"total_amount" numeric(15, 0) NOT NULL,
	"paid_amount" numeric(15, 0) NOT NULL,
	"balance_amount" numeric(15, 0) NOT NULL,
	"notes" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_vouchers_voucher_number_unique" UNIQUE("voucher_number")
);
--> statement-breakpoint
ALTER TABLE "project_payments" ADD CONSTRAINT "project_payments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_payments" ADD CONSTRAINT "project_payments_voucher_id_project_vouchers_id_fk" FOREIGN KEY ("voucher_id") REFERENCES "public"."project_vouchers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_payments" ADD CONSTRAINT "project_payments_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_payments" ADD CONSTRAINT "project_payments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_vouchers" ADD CONSTRAINT "project_vouchers_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_vouchers" ADD CONSTRAINT "project_vouchers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_payments_project_id_idx" ON "project_payments" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_payments_voucher_id_idx" ON "project_payments" USING btree ("voucher_id");--> statement-breakpoint
CREATE INDEX "project_payments_payment_date_idx" ON "project_payments" USING btree ("payment_date");--> statement-breakpoint
CREATE INDEX "project_vouchers_project_id_idx" ON "project_vouchers" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_vouchers_voucher_type_idx" ON "project_vouchers" USING btree ("voucher_type");