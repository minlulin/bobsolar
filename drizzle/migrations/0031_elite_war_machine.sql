-- Migration 0031: Simplify user role model and add owner soft-archive
--
-- Changes:
--   1. Rename user_role enum value 'staff' → 'owner' (safe in-place rename)
--   2. Add users.archived_at (soft-delete for admin account)
--   3. Add owners.deleted_at (soft-archive for partners)
--   4. Add owners.slot (A/B/C) and backfill for existing owners (alphabetical by name)
--   5. Add check constraint on slot and partial unique index for active owners only

-- 1. Rename enum value 'staff' → 'owner' (PostgreSQL RENAME VALUE preserves data)
ALTER TYPE "public"."user_role" RENAME VALUE 'staff' TO 'owner';--> statement-breakpoint

-- 2. Update default on users.role to use new value
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'owner'::"public"."user_role";--> statement-breakpoint

-- 3. Add users.archived_at (soft-archive for admin account)
ALTER TABLE "users" ADD COLUMN "archived_at" timestamp;--> statement-breakpoint

-- 4. Add owners.deleted_at (soft-archive for partners)
ALTER TABLE "owners" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint

-- 5. Add owners.slot as nullable first, backfill, then make NOT NULL
ALTER TABLE "owners" ADD COLUMN "slot" text;--> statement-breakpoint

-- 6. Backfill slot for existing active owners in alphabetical order by name.
--    Active owners with 1, 2, or 3 entries get slots A, B, C respectively.
--    Archived owners (deleted_at IS NOT NULL) are skipped — they will not
--    participate in the slot uniqueness constraint and can be re-archived
--    without conflicts. If more than 3 active owners exist, this raises an
--    error and the migration must be interrupted manually.
DO $$
DECLARE
  counter INTEGER := 0;
  owner_record RECORD;
  slot_letter TEXT;
BEGIN
  FOR owner_record IN
    SELECT o.id, u.name
    FROM owners o
    JOIN users u ON o.user_id = u.id
    WHERE o.deleted_at IS NULL
    ORDER BY u.name ASC
  LOOP
    counter := counter + 1;
    IF counter = 1 THEN slot_letter := 'A';
    ELSIF counter = 2 THEN slot_letter := 'B';
    ELSIF counter = 3 THEN slot_letter := 'C';
    ELSE
      RAISE EXCEPTION 'Cannot backfill owners.slot: more than 3 active owners exist. Resolve manually before re-running.';
    END IF;
    UPDATE owners SET slot = slot_letter WHERE id = owner_record.id;
  END LOOP;
END $$;--> statement-breakpoint

-- 7. Make slot NOT NULL after backfill
ALTER TABLE "owners" ALTER COLUMN "slot" SET NOT NULL;--> statement-breakpoint

-- 8. Check constraint enforces valid slot values
ALTER TABLE "owners" ADD CONSTRAINT "owners_slot_check" CHECK ("owners"."slot" IN ('A', 'B', 'C'));--> statement-breakpoint

-- 9. Partial unique index: at most one ACTIVE owner per slot.
--    Archived owners (deleted_at IS NOT NULL) are excluded so the same
--    slot can be reused after archiving the previous holder.
CREATE UNIQUE INDEX "owners_active_slot_unique" ON "owners" USING btree ("slot") WHERE "owners"."deleted_at" IS NULL;
