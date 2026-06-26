ALTER TYPE "public"."user_role" ADD VALUE 'technician';--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD COLUMN "danger_level" text;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;
