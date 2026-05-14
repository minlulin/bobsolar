ALTER TABLE "quotations"
ADD COLUMN IF NOT EXISTS "is_archived" boolean DEFAULT false NOT NULL;

ALTER TABLE "quotations"
ADD COLUMN IF NOT EXISTS "archived_at" timestamp;

CREATE INDEX IF NOT EXISTS "quotations_archived_status_created_at_idx"
ON "quotations" ("is_archived", "status", "created_at");
