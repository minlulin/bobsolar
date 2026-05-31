ALTER TYPE "public"."journal_source_type" ADD VALUE 'general_expense';--> statement-breakpoint
ALTER TYPE "public"."journal_source_type" ADD VALUE 'payroll';--> statement-breakpoint
ALTER TYPE "public"."journal_source_type" ADD VALUE 'equity_distribution';--> statement-breakpoint
ALTER TYPE "public"."journal_source_type" ADD VALUE 'owner_draw';--> statement-breakpoint
ALTER TYPE "public"."journal_source_type" ADD VALUE 'capital_call';--> statement-breakpoint
CREATE TABLE "general_expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payee_name" text NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"expense_date" timestamp DEFAULT now() NOT NULL,
	"account_id" uuid NOT NULL,
	"payment_method_id" uuid,
	"reference" text,
	"notes" text,
	"is_paid" boolean DEFAULT true NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "owner_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"transaction_type" text NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"transaction_date" timestamp DEFAULT now() NOT NULL,
	"status" text NOT NULL,
	"journal_entry_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "owners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"ownership_percentage" numeric(5, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "owners_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "general_expenses" ADD CONSTRAINT "general_expenses_account_id_ledger_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."ledger_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "general_expenses" ADD CONSTRAINT "general_expenses_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "general_expenses" ADD CONSTRAINT "general_expenses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_transactions" ADD CONSTRAINT "owner_transactions_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_transactions" ADD CONSTRAINT "owner_transactions_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owners" ADD CONSTRAINT "owners_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;