CREATE INDEX "notifications_user_read_created_at_idx" ON "notifications" USING btree ("user_id","is_read","created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_created_at_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_dedupe_key_idx" ON "notifications" USING btree ("notification_dedupe_key");--> statement-breakpoint
CREATE INDEX "projects_status_created_at_idx" ON "projects" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "projects_customer_id_idx" ON "projects" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "projects_quotation_id_idx" ON "projects" USING btree ("quotation_id");--> statement-breakpoint
CREATE INDEX "quotations_status_created_at_idx" ON "quotations" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "quotations_customer_id_idx" ON "quotations" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "quotations_created_by_idx" ON "quotations" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "warranty_alerts_resolved_due_date_idx" ON "warranty_alerts" USING btree ("is_resolved","due_date");--> statement-breakpoint
CREATE INDEX "warranty_alerts_project_id_idx" ON "warranty_alerts" USING btree ("project_id");