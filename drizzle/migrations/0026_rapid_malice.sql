ALTER TABLE "project_costs" DROP CONSTRAINT "project_costs_project_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "project_payments" DROP CONSTRAINT "project_payments_project_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "project_remarks" DROP CONSTRAINT "project_remarks_project_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "project_vouchers" DROP CONSTRAINT "project_vouchers_project_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "warranty_alerts" DROP CONSTRAINT "warranty_alerts_project_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "project_costs" ADD CONSTRAINT "project_costs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_payments" ADD CONSTRAINT "project_payments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_remarks" ADD CONSTRAINT "project_remarks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_vouchers" ADD CONSTRAINT "project_vouchers_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warranty_alerts" ADD CONSTRAINT "warranty_alerts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "supplier_payments_purchase_order_id_idx" ON "supplier_payments" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "warranty_alerts_active_project_description_unique" ON "warranty_alerts" USING btree ("project_id","description") WHERE "warranty_alerts"."is_resolved" = false;