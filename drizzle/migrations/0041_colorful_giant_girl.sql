ALTER TABLE "inventory_items" ALTER COLUMN "category" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."inventory_category";--> statement-breakpoint
CREATE TYPE "public"."inventory_category" AS ENUM('panel', 'inverter', 'battery', 'mounting', 'cable', 'accessory', 'protection');--> statement-breakpoint
ALTER TABLE "inventory_items" ALTER COLUMN "category" SET DATA TYPE "public"."inventory_category" USING "category"::"public"."inventory_category";