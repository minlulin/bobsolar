CREATE TABLE IF NOT EXISTS "auth_rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp,
	"last_attempt_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_rate_limits_locked_until_idx" ON "auth_rate_limits" USING btree ("locked_until");
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "archived_at" timestamp;
