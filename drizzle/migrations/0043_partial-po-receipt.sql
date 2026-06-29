-- Partial PO Receipt Support (GAP-1)
-- Adds received_quantity column to track per-line received amounts

ALTER TABLE "purchase_order_items" ADD COLUMN IF NOT EXISTS "received_quantity" numeric(12, 2) DEFAULT 0 NOT NULL;
