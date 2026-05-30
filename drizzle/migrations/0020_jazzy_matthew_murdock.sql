ALTER TYPE "public"."cost_type" ADD VALUE IF NOT EXISTS 'general';--> statement-breakpoint
ALTER TABLE "sessions" DROP COLUMN "role";--> statement-breakpoint
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_name_unique" UNIQUE("name");