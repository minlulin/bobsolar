ALTER TABLE "project_costs" ADD COLUMN "quantity" integer;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;