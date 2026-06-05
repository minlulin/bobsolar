CREATE INDEX "general_expenses_account_id_idx" ON "general_expenses" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "general_expenses_payment_method_id_idx" ON "general_expenses" USING btree ("payment_method_id");--> statement-breakpoint
CREATE INDEX "owner_transactions_owner_id_idx" ON "owner_transactions" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "owner_transactions_type_status_idx" ON "owner_transactions" USING btree ("transaction_type","status");--> statement-breakpoint
CREATE INDEX "purchase_order_items_purchase_order_id_idx" ON "purchase_order_items" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "purchase_orders_supplier_id_idx" ON "purchase_orders" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "purchase_orders_status_idx" ON "purchase_orders" USING btree ("status");