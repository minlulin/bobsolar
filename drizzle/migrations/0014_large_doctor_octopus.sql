ALTER TABLE "journal_entries" ADD COLUMN "is_reversed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD COLUMN "reversed_by" uuid;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_reversed_by_users_id_fk" FOREIGN KEY ("reversed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "journal_entries_is_reversed_idx" ON "journal_entries" USING btree ("is_reversed");