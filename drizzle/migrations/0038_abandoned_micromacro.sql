ALTER TYPE "public"."user_role" ADD VALUE 'technician';--> statement-breakpoint
ALTER TABLE "chat_messages" DROP CONSTRAINT "chat_messages_parent_message_id_chat_messages_id_fk";
--> statement-breakpoint
ALTER TABLE "chat_usage_logs" ADD COLUMN "ip_address" text;--> statement-breakpoint
ALTER TABLE "chat_usage_logs" ADD COLUMN "user_agent" text;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD COLUMN "danger_level" text;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "chat_usage_logs_ip_address_idx" ON "chat_usage_logs" USING btree ("ip_address");