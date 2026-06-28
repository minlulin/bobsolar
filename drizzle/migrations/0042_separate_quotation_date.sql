-- Separate quotationDate from createdAt to fix backdated quote numbering (H3)
-- quotationDate is the user-chosen display date; createdAt remains the immutable
-- DB timestamp used for quote-number sequence generation.

ALTER TABLE "quotations" ADD COLUMN "quotation_date" timestamp;

-- Backfill existing rows: use createdAt as the display date for existing quotations
UPDATE "quotations" SET "quotation_date" = "created_at" WHERE "quotation_date" IS NULL;
