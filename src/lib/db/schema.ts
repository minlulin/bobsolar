import { type InferInsertModel, type InferSelectModel, relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  decimal,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// --- Enums ---

export const userRoleEnum = pgEnum("user_role", ["admin", "owner", "technician"]);

export type UserRole = (typeof userRoleEnum.enumValues)[number];

export const inventoryCategoryEnum = pgEnum("inventory_category", [
  "panel",
  "inverter",
  "battery",
  "mounting",
  "cable",
  "accessory",
  "protection",
]);

export type InventoryCategory = (typeof inventoryCategoryEnum.enumValues)[number];

export const inventoryUnitEnum = pgEnum("inventory_unit", ["pcs", "meter", "set", "kWp", "job"]);

export type InventoryUnit = (typeof inventoryUnitEnum.enumValues)[number];

export const quotationStatusEnum = pgEnum("quotation_status", [
  "draft",
  "sent",
  "accepted",
  "rejected",
  "expired",
]);

export type QuotationStatus = (typeof quotationStatusEnum.enumValues)[number];

export const projectStatusEnum = pgEnum("project_status", [
  "planning",
  "in_progress",
  "on_hold",
  "installation_completed",
  "completed",
  "cancelled",
]);

export type ProjectStatus = (typeof projectStatusEnum.enumValues)[number];

export const projectInvoiceStatusEnum = pgEnum("project_invoice_status", [
  "draft",
  "unpaid",
  "partial",
  "paid",
  "voided",
]);

export type ProjectInvoiceStatus = (typeof projectInvoiceStatusEnum.enumValues)[number];

export const costTypeEnum = pgEnum("cost_type", [
  "material",
  "labor",
  "transport",
  "misc",
  "general",
]);

export type CostType = (typeof costTypeEnum.enumValues)[number];

export const remarkTypeEnum = pgEnum("remark_type", ["note", "issue", "update"]);

export type RemarkType = (typeof remarkTypeEnum.enumValues)[number];

export const alertTypeEnum = pgEnum("alert_type", [
  "warranty_expiry",
  "maintenance_due",
  "follow_up",
]);

export type AlertType = (typeof alertTypeEnum.enumValues)[number];

export const notificationTypeEnum = pgEnum("notification_type", ["info", "warning", "action"]);

export type NotificationType = (typeof notificationTypeEnum.enumValues)[number];

export const voucherTypeEnum = pgEnum("voucher_type", [
  "completion_certificate",
  "final_payment_voucher",
]);

export type VoucherType = (typeof voucherTypeEnum.enumValues)[number];

export const ledgerAccountTypeEnum = pgEnum("ledger_account_type", [
  "asset",
  "liability",
  "equity",
  "income",
  "expense",
]);

export type LedgerAccountType = (typeof ledgerAccountTypeEnum.enumValues)[number];

export const journalSourceTypeEnum = pgEnum("journal_source_type", [
  "project_payment",
  "project_expense",
  "inventory_consumption",
  "manual_adjustment",
  "opening_balance",
  "backfill",
  "supplier_purchase",
  "supplier_payment",
  "project_invoice",
  "cash_transfer",
  "general_expense",
  "payroll",
  "equity_distribution",
  "owner_draw",
  "capital_call",
  "project_change_order",
]);

export type JournalSourceType = (typeof journalSourceTypeEnum.enumValues)[number];

export const purchaseOrderStatusEnum = pgEnum("purchase_order_status", [
  "draft",
  "received",
  "cancelled",
]);

export type PurchaseOrderStatus = (typeof purchaseOrderStatusEnum.enumValues)[number];

export const supplierPaymentStatusEnum = pgEnum("supplier_payment_status", [
  "unpaid",
  "partial",
  "paid",
]);

export type SupplierPaymentStatus = (typeof supplierPaymentStatusEnum.enumValues)[number];

export const accountingPeriodStatusEnum = pgEnum("accounting_period_status", [
  "open",
  "soft_closed",
  "closed",
]);

export type AccountingPeriodStatus = (typeof accountingPeriodStatusEnum.enumValues)[number];

export const auditActionEnum = pgEnum("audit_action", [
  "password_change",
  "login",
  "logout",
  "session_revoke",
  "csrf_blocked",
  "rate_limit_hit",
  "quota_exceeded",
]);

export type AuditAction = (typeof auditActionEnum.enumValues)[number];

export const ownerTransactionTypeEnum = pgEnum("owner_transaction_type", [
  "distribution",
  "draw",
  "capital_call_issued",
  "capital_contribution",
]);

export type OwnerTransactionType = (typeof ownerTransactionTypeEnum.enumValues)[number];

export const ownerTransactionStatusEnum = pgEnum("owner_transaction_status", [
  "pending",
  "completed",
]);

export type OwnerTransactionStatus = (typeof ownerTransactionStatusEnum.enumValues)[number];

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: userRoleEnum("role").default("owner").notNull(),
  archivedAt: timestamp("archived_at"),
  /**
   * Monotonic stamp baked into the sealed session cookie at login time.
   * Bumped on password change, partner archive, and any other "kill all
   * sessions" event. Stale cookies still unseal, but the sv mismatch in
   * `requireAuth` rejects them as "session revoked".
   *
   * Replaces the legacy `sessions` row lookup (see migration 0032/0033).
   */
  sessionVersion: integer("session_version").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const authRateLimits = pgTable(
  "auth_rate_limits",
  {
    key: text("key").primaryKey(),
    attempts: integer("attempts").default(0).notNull(),
    lockedUntil: timestamp("locked_until"),
    lastAttemptAt: timestamp("last_attempt_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("auth_rate_limits_locked_until_idx").on(table.lockedUntil)],
);

export const customers = pgTable("customers", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone").notNull(),
  address: text("address"),
  city: text("city"),
  notes: text("notes"),
  isArchived: boolean("is_archived").default(false).notNull(),
  archivedAt: timestamp("archived_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const inventoryItems = pgTable(
  "inventory_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    category: inventoryCategoryEnum("category").notNull(),
    unit: inventoryUnitEnum("unit").notNull(),
    costPrice: decimal("cost_price", { precision: 15, scale: 2 }).default("0").notNull(),
    unitPrice: decimal("unit_price", { precision: 15, scale: 2 }).notNull(),
    stockQty: integer("stock_qty").default(0).notNull(),
    // Business rule: stock quantity must never go negative.
    // Enforced at the DB level via CHECK constraint (see table constraints below).
    brand: text("brand"),
    modelNumber: text("model_number"),
    specifications: jsonb("specifications"),
    durationMonths: integer("duration_months").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [check("inventory_items_stock_qty_non_negative", sql`${table.stockQty} >= 0`)],
);

export const quotations = pgTable(
  "quotations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    quoteNumber: text("quote_number").unique().notNull(), // QT-2026-0001
    customerId: uuid("customer_id")
      .references(() => customers.id, { onDelete: "restrict" })
      .notNull(),
    createdBy: uuid("created_by")
      .references(() => users.id)
      .notNull(),
    status: quotationStatusEnum("status").default("draft").notNull(),
    subtotal: decimal("subtotal", { precision: 15, scale: 2 }).notNull(),
    discountPercent: decimal("discount_percent", {
      precision: 5,
      scale: 2,
    })
      .default("0")
      .notNull(),
    discountAmount: decimal("discount_amount", {
      precision: 15,
      scale: 2,
    })
      .default("0")
      .notNull(),
    taxPercent: decimal("tax_percent", { precision: 5, scale: 2 }).default("0").notNull(),
    taxAmount: decimal("tax_amount", { precision: 15, scale: 2 }).default("0").notNull(),
    total: decimal("total", { precision: 15, scale: 2 }).notNull(),
    notes: text("notes"),
    validUntil: timestamp("valid_until"),
    /**
     * Business/display date chosen by the user (e.g. backdated quote).
     * Immutable `createdAt` is the real DB creation timestamp and is used
     * for quote-number sequence generation so that backdating cannot
     * produce duplicate quote numbers.
     */
    quotationDate: timestamp("quotation_date"),
    isArchived: boolean("is_archived").default(false).notNull(),
    archivedAt: timestamp("archived_at"),
    revisionNumber: integer("revision_number").default(1).notNull(),
    originalQuotationId: uuid("original_quotation_id")
      // biome-ignore lint/suspicious/noExplicitAny: self-reference requires cast to avoid type circularity
      .references((): any => (quotations as any).id, { onDelete: "cascade" }),
    revisionReason: text("revision_reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("quotations_status_created_at_idx").on(table.status, table.createdAt),
    index("quotations_archived_status_created_at_idx").on(
      table.isArchived,
      table.status,
      table.createdAt,
    ),
    index("quotations_customer_id_idx").on(table.customerId),
    index("quotations_created_by_idx").on(table.createdBy),
  ],
);

export const quotationItems = pgTable(
  "quotation_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    quotationId: uuid("quotation_id")
      // biome-ignore lint/suspicious/noExplicitAny: break circular dependency
      .references(() => (quotations as any).id, { onDelete: "cascade" })
      .notNull(),
    itemId: uuid("item_id").references(() => inventoryItems.id),
    description: text("description").notNull(),
    quantity: decimal("quantity", { precision: 12, scale: 2 }).notNull(),
    discountPercentage: decimal("discount_percentage", {
      precision: 5,
      scale: 2,
    }).default("0"),
    unitPrice: decimal("unit_price", { precision: 15, scale: 2 }).notNull(), // Sell price snapshot
    costPrice: decimal("cost_price", { precision: 15, scale: 2 }).default("0").notNull(), // Buy price snapshot
    totalPrice: decimal("total_price", { precision: 15, scale: 2 }).notNull(),
    costTotal: decimal("cost_total", { precision: 15, scale: 2 }).default("0").notNull(), // Buy total = costPrice × qty
    sortOrder: integer("sort_order").notNull(),
  },
  (table) => [index("quotation_items_quotation_id_idx").on(table.quotationId)],
);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectNumber: text("project_number").unique().notNull(), // PJ-2026-0001
    quotationId: uuid("quotation_id")
      // biome-ignore lint/suspicious/noExplicitAny: break circular dependency
      .references(() => (quotations as any).id),
    customerId: uuid("customer_id")
      .references(() => customers.id)
      .notNull(),
    status: projectStatusEnum("status").default("planning").notNull(),
    siteAddress: text("site_address").notNull(),
    systemSizeKwp: decimal("system_size_kwp", {
      precision: 10,
      scale: 2,
    }).notNull(),
    quotedTotal: decimal("quoted_total", { precision: 15, scale: 2 }).notNull(),
    estimatedCogs: decimal("estimated_cogs", { precision: 15, scale: 2 }).default("0").notNull(),
    actualTotal: decimal("actual_total", {
      precision: 15,
      scale: 2,
    }).default("0"),
    startDate: timestamp("start_date"),
    targetCompletion: timestamp("target_completion"),
    actualCompletion: timestamp("actual_completion"),
    depositRequired: boolean("deposit_required").default(false).notNull(),
    depositAmount: decimal("deposit_amount", { precision: 15, scale: 2 }).default("0").notNull(),
    depositReceived: boolean("deposit_received").default(false).notNull(),
    handoverDate: timestamp("handover_date"),
    handoverAcknowledgedBy: text("handover_acknowledged_by"),
    handoverAcknowledgedAt: timestamp("handover_acknowledged_at"),
    handoverPdfUrl: text("handover_pdf_url"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    // Unique constraint: one project per quotation (where quotation_id is not null)
    uniqueIndex("projects_quotation_id_unique")
      .on(table.quotationId)
      .where(sql`${table.quotationId} is not null`),
    index("projects_status_created_at_idx").on(table.status, table.createdAt),
    index("projects_customer_id_idx").on(table.customerId),
    index("projects_quotation_id_idx").on(table.quotationId),
  ],
);

export const projectCosts = pgTable(
  "project_costs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .references(() => projects.id, { onDelete: "restrict" })
      .notNull(),
    itemId: uuid("item_id").references(() => inventoryItems.id),
    paymentMethodId: uuid("payment_method_id").references(() => paymentMethods.id),
    description: text("description").notNull(),
    amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
    quantity: integer("quantity"),
    costType: costTypeEnum("cost_type").notNull(),
    incurredDate: timestamp("incurred_date").defaultNow().notNull(),
    addedBy: uuid("added_by")
      .references(() => users.id)
      .notNull(),
    isReversed: boolean("is_reversed").default(false).notNull(),
  },
  (table) => [
    index("project_costs_project_id_idx").on(table.projectId),
    index("project_costs_incurred_date_idx").on(table.incurredDate),
    index("project_costs_payment_method_id_idx").on(table.paymentMethodId),
  ],
);

export const projectRemarks = pgTable(
  "project_remarks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .references(() => projects.id, { onDelete: "restrict" })
      .notNull(),
    authorId: uuid("author_id")
      .references(() => users.id)
      .notNull(),
    content: text("content").notNull(),
    remarkType: remarkTypeEnum("remark_type").default("note").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("project_remarks_project_id_idx").on(table.projectId)],
);

export const changeOrderStatusEnum = pgEnum("change_order_status", [
  "draft",
  "approved",
  "rejected",
  "cancelled",
]);

export type ChangeOrderStatus = (typeof changeOrderStatusEnum.enumValues)[number];

export const projectChangeOrders = pgTable(
  "project_change_orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .references(() => projects.id, { onDelete: "restrict" })
      .notNull(),
    changeOrderNumber: text("change_order_number").unique().notNull(),
    status: changeOrderStatusEnum("status").default("draft").notNull(),
    description: text("description").notNull(),
    additionalAmount: decimal("additional_amount", { precision: 15, scale: 2 })
      .default("0")
      .notNull(),
    originalQuotationId: uuid("original_quotation_id")
      // biome-ignore lint/suspicious/noExplicitAny: break circular dependency
      .references(() => (quotations as any).id),
    approvedBy: uuid("approved_by").references(() => users.id),
    approvedAt: timestamp("approved_at"),
    createdBy: uuid("created_by")
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("project_change_orders_project_id_idx").on(table.projectId)],
);

export const projectChangeOrderItems = pgTable(
  "project_change_order_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    changeOrderId: uuid("change_order_id")
      .references(() => projectChangeOrders.id, { onDelete: "cascade" })
      .notNull(),
    itemId: uuid("item_id").references(() => inventoryItems.id),
    description: text("description").notNull(),
    quantity: decimal("quantity", { precision: 12, scale: 2 }).notNull(),
    unitPrice: decimal("unit_price", { precision: 15, scale: 2 }).notNull(),
    totalPrice: decimal("total_price", { precision: 15, scale: 2 }).notNull(),
    isAddition: boolean("is_addition").default(true).notNull(),
  },
  (table) => [index("project_change_order_items_change_order_id_idx").on(table.changeOrderId)],
);

export const warrantyAlerts = pgTable(
  "warranty_alerts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .references(() => projects.id, { onDelete: "restrict" })
      .notNull(),
    alertType: alertTypeEnum("alert_type").notNull(),
    description: text("description").notNull(),
    dueDate: timestamp("due_date").notNull(),
    isResolved: boolean("is_resolved").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("warranty_alerts_resolved_due_date_idx").on(table.isResolved, table.dueDate),
    index("warranty_alerts_project_id_idx").on(table.projectId),
    uniqueIndex("warranty_alerts_active_project_description_unique")
      .on(table.projectId, table.description)
      .where(sql`${table.isResolved} = false`),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    type: notificationTypeEnum("type").default("info").notNull(),
    link: text("link"),
    isRead: boolean("is_read").default(false).notNull(),
    notificationDedupeKey: text("notification_dedupe_key"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("notifications_user_read_created_at_idx").on(table.userId, table.isRead, table.createdAt),
    index("notifications_user_created_at_idx").on(table.userId, table.createdAt),
    index("notifications_dedupe_key_idx").on(table.notificationDedupeKey),
    // DB-level dedupe guarantee. Pairs with `onConflictDoNothing()` on
    // every notification insert so concurrent crons can't double-write.
    // Multiple rows with NULL dedupe key remain allowed (Postgres treats
    // NULLs as distinct in unique constraints by default).
    unique("notifications_user_dedupe_key_unique").on(table.userId, table.notificationDedupeKey),
  ],
);

export const companySettings = pgTable("company_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const projectInvoices = pgTable(
  "project_invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .references(() => projects.id, { onDelete: "restrict" })
      .notNull(),
    customerId: uuid("customer_id")
      .references(() => customers.id)
      .notNull(),
    invoiceNumber: text("invoice_number").unique().notNull(),
    invoiceDate: timestamp("invoice_date").notNull(),
    dueDate: timestamp("due_date").notNull(),
    status: projectInvoiceStatusEnum("status").default("draft").notNull(),
    subtotal: decimal("subtotal", { precision: 15, scale: 2 }).notNull(),
    taxAmount: decimal("tax_amount", { precision: 15, scale: 2 }).default("0").notNull(),
    total: decimal("total", { precision: 15, scale: 2 }).notNull(),
    paidAmount: decimal("paid_amount", { precision: 15, scale: 2 }).default("0").notNull(),
    balanceDue: decimal("balance_due", { precision: 15, scale: 2 }).notNull(),
    postedEntryId: uuid("posted_entry_id").references(() => journalEntries.id),
    createdBy: uuid("created_by")
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("project_invoices_project_id_idx").on(table.projectId),
    index("project_invoices_customer_id_idx").on(table.customerId),
    index("project_invoices_status_idx").on(table.status),
    index("project_invoices_due_date_idx").on(table.dueDate),
  ],
);

export const projectInvoiceLines = pgTable(
  "project_invoice_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    invoiceId: uuid("invoice_id")
      .references(() => projectInvoices.id, { onDelete: "cascade" })
      .notNull(),
    description: text("description").notNull(),
    quantity: decimal("quantity", { precision: 12, scale: 2 }).notNull(),
    unitPrice: decimal("unit_price", { precision: 15, scale: 2 }).notNull(),
    taxAmount: decimal("tax_amount", { precision: 15, scale: 2 }).default("0").notNull(),
    lineTotal: decimal("line_total", { precision: 15, scale: 2 }).notNull(),
    sortOrder: integer("sort_order").notNull(),
  },
  (table) => [index("project_invoice_lines_invoice_id_idx").on(table.invoiceId)],
);

export const projectPaymentAllocations = pgTable(
  "project_payment_allocations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    paymentId: uuid("payment_id")
      .references(() => projectPayments.id, { onDelete: "cascade" })
      .notNull(),
    invoiceId: uuid("invoice_id")
      .references(() => projectInvoices.id, { onDelete: "restrict" })
      .notNull(),
    amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("project_payment_allocations_payment_id_idx").on(table.paymentId),
    index("project_payment_allocations_invoice_id_idx").on(table.invoiceId),
  ],
);

export const projectVouchers = pgTable(
  "project_vouchers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .references(() => projects.id, { onDelete: "restrict" })
      .notNull(),
    invoiceId: uuid("invoice_id").references(() => projectInvoices.id, { onDelete: "set null" }),
    voucherNumber: text("voucher_number").unique().notNull(),
    voucherType: voucherTypeEnum("voucher_type").notNull(),
    issuedAt: timestamp("issued_at").defaultNow().notNull(),
    totalAmount: decimal("total_amount", { precision: 15, scale: 2 }).notNull(),
    paidAmount: decimal("paid_amount", { precision: 15, scale: 2 }).notNull(),
    balanceAmount: decimal("balance_amount", {
      precision: 15,
      scale: 2,
    }).notNull(),
    notes: text("notes"),
    createdBy: uuid("created_by")
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("project_vouchers_project_id_idx").on(table.projectId),
    index("project_vouchers_voucher_type_idx").on(table.voucherType),
  ],
);

export const paymentMethods = pgTable("payment_methods", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").unique().notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const projectPayments = pgTable(
  "project_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .references(() => projects.id, { onDelete: "restrict" })
      .notNull(),
    voucherId: uuid("voucher_id").references(() => projectVouchers.id),
    amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
    paymentMethodId: uuid("payment_method_id")
      .references(() => paymentMethods.id)
      .notNull(),
    paymentDate: timestamp("payment_date").defaultNow().notNull(),
    reference: text("reference"),
    notes: text("notes"),
    createdBy: uuid("created_by")
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("project_payments_project_id_idx").on(table.projectId),
    index("project_payments_voucher_id_idx").on(table.voucherId),
    index("project_payments_payment_date_idx").on(table.paymentDate),
  ],
);

export const suppliers = pgTable("suppliers", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  companyName: text("company_name"),
  notes: text("notes"),
  totalOwed: decimal("total_owed", { precision: 15, scale: 2 }).default("0").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const purchaseOrders = pgTable(
  "purchase_orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    poNumber: text("po_number").unique().notNull(),
    supplierId: uuid("supplier_id")
      .references(() => suppliers.id, { onDelete: "restrict" })
      .notNull(),
    status: purchaseOrderStatusEnum("status").default("draft").notNull(),
    totalAmount: decimal("total_amount", { precision: 15, scale: 2 }).notNull(),
    paidAmount: decimal("paid_amount", { precision: 15, scale: 2 }).default("0").notNull(),
    balanceDue: decimal("balance_due", { precision: 15, scale: 2 }).notNull(),
    paymentStatus: supplierPaymentStatusEnum("payment_status").default("unpaid").notNull(),
    billDate: timestamp("bill_date"),
    dueDate: timestamp("due_date"),
    notes: text("notes"),
    receivedAt: timestamp("received_at"),
    createdBy: uuid("created_by")
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("purchase_orders_supplier_id_idx").on(table.supplierId),
    index("purchase_orders_status_idx").on(table.status),
  ],
);

export const purchaseOrderItems = pgTable(
  "purchase_order_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    purchaseOrderId: uuid("purchase_order_id")
      .references(() => purchaseOrders.id, { onDelete: "cascade" })
      .notNull(),
    itemId: uuid("item_id")
      .references(() => inventoryItems.id)
      .notNull(),
    description: text("description").notNull(),
    quantity: decimal("quantity", { precision: 12, scale: 2 }).notNull(),
    unitPrice: decimal("unit_price", { precision: 15, scale: 2 }).notNull(),
    totalPrice: decimal("total_price", { precision: 15, scale: 2 }).notNull(),
    sortOrder: integer("sort_order").notNull(),
    receivedQuantity: decimal("received_quantity", { precision: 12, scale: 2 })
      .default("0")
      .notNull(),
  },
  (table) => [index("purchase_order_items_purchase_order_id_idx").on(table.purchaseOrderId)],
);

export const supplierPayments = pgTable(
  "supplier_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    purchaseOrderId: uuid("purchase_order_id")
      .references(() => purchaseOrders.id, { onDelete: "cascade" })
      .notNull(),
    supplierId: uuid("supplier_id")
      .references(() => suppliers.id)
      .notNull(),
    amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
    paymentMethodId: uuid("payment_method_id")
      .references(() => paymentMethods.id)
      .notNull(),
    paymentDate: timestamp("payment_date").defaultNow().notNull(),
    reference: text("reference"),
    notes: text("notes"),
    createdBy: uuid("created_by")
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("supplier_payments_purchase_order_id_idx").on(table.purchaseOrderId)],
);

export const ledgerAccounts = pgTable(
  "ledger_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").unique().notNull(),
    name: text("name").notNull(),
    type: ledgerAccountTypeEnum("type").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("ledger_accounts_code_idx").on(table.code),
    index("ledger_accounts_type_idx").on(table.type),
  ],
);

export const journalEntries = pgTable(
  "journal_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entryDate: timestamp("entry_date").defaultNow().notNull(),
    memo: text("memo"),
    sourceType: journalSourceTypeEnum("source_type").notNull(),
    sourceId: uuid("source_id"),
    createdBy: uuid("created_by")
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    isReversed: boolean("is_reversed").default(false).notNull(),
    reversedBy: uuid("reversed_by").references(() => users.id),
  },
  (table) => [
    index("journal_entries_date_reversed_idx").on(table.entryDate, table.isReversed),
    index("journal_entries_source_idx").on(table.sourceType, table.sourceId),
    index("journal_entries_created_by_idx").on(table.createdBy),
  ],
);

export const journalLines = pgTable(
  "journal_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entryId: uuid("entry_id")
      .references(() => journalEntries.id, { onDelete: "cascade" })
      .notNull(),
    accountId: uuid("account_id")
      .references(() => ledgerAccounts.id)
      .notNull(),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    debit: decimal("debit", { precision: 15, scale: 2 }).default("0").notNull(),
    credit: decimal("credit", { precision: 15, scale: 2 }).default("0").notNull(),
    memo: text("memo"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("journal_lines_entry_id_idx").on(table.entryId),
    index("journal_lines_account_id_idx").on(table.accountId),
    index("journal_lines_project_id_idx").on(table.projectId),
    check("journal_lines_non_negative_check", sql`${table.debit} >= 0 and ${table.credit} >= 0`),
    check(
      "journal_lines_single_side_check",
      sql`(${table.debit} > 0 and ${table.credit} = 0) or (${table.credit} > 0 and ${table.debit} = 0)`,
    ),
  ],
);

export const budgets = pgTable(
  "budgets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountCode: text("account_code")
      .references(() => ledgerAccounts.code)
      .notNull(),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    budgetAmount: decimal("budget_amount", { precision: 15, scale: 2 }).notNull(),
    notes: text("notes"),
    createdBy: uuid("created_by")
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    unique("budgets_account_period_unique").on(
      table.accountCode,
      table.periodStart,
      table.periodEnd,
    ),
  ],
);

export const accountingPeriods = pgTable("accounting_periods", {
  id: uuid("id").defaultRandom().primaryKey(),
  periodMonth: text("period_month").unique().notNull(),
  status: accountingPeriodStatusEnum("status").default("open").notNull(),
  closedBy: uuid("closed_by").references(() => users.id),
  closedAt: timestamp("closed_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const generalExpenses = pgTable(
  "general_expenses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    payeeName: text("payee_name").notNull(),
    amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
    expenseDate: timestamp("expense_date").defaultNow().notNull(),
    accountId: uuid("account_id")
      .references(() => ledgerAccounts.id)
      .notNull(),
    paymentMethodId: uuid("payment_method_id").references(() => paymentMethods.id),
    reference: text("reference"),
    notes: text("notes"),
    isPaid: boolean("is_paid").default(true).notNull(),
    createdBy: uuid("created_by")
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("general_expenses_account_id_idx").on(table.accountId),
    index("general_expenses_payment_method_id_idx").on(table.paymentMethodId),
  ],
);

export const owners = pgTable(
  "owners",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull()
      .unique(),
    slot: text("slot").notNull(),
    ownershipPercentage: decimal("ownership_percentage", { precision: 5, scale: 2 }).notNull(),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    check("owners_slot_check", sql`${table.slot} IN ('A', 'B', 'C')`),
    uniqueIndex("owners_active_slot_unique").on(table.slot).where(sql`${table.deletedAt} IS NULL`),
  ],
);

export const ownerTransactions = pgTable(
  "owner_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id")
      .references(() => owners.id)
      .notNull(),
    transactionType: ownerTransactionTypeEnum("transaction_type").notNull(),
    amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
    transactionDate: timestamp("transaction_date").defaultNow().notNull(),
    status: ownerTransactionStatusEnum("status").notNull(),
    journalEntryId: uuid("journal_entry_id").references(() => journalEntries.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("owner_transactions_owner_id_idx").on(table.ownerId),
    index("owner_transactions_type_status_idx").on(table.transactionType, table.status),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({
  quotations: many(quotations),
  projectCosts: many(projectCosts),
  projectRemarks: many(projectRemarks),
  notifications: many(notifications),
  generalExpenses: many(generalExpenses),
}));

export const customersRelations = relations(customers, ({ many }) => ({
  quotations: many(quotations),
  projects: many(projects),
}));

export const inventoryItemsRelations = relations(inventoryItems, ({ many }) => ({
  quotationItems: many(quotationItems),
  projectCosts: many(projectCosts),
}));

export const quotationsRelations = relations(quotations, ({ one, many }) => ({
  customer: one(customers, {
    fields: [quotations.customerId],
    references: [customers.id],
  }),
  createdBy: one(users, {
    fields: [quotations.createdBy],
    references: [users.id],
  }),
  items: many(quotationItems),
  project: one(projects, {
    fields: [quotations.id],
    references: [projects.quotationId],
  }),
  parentQuotation: one(quotations, {
    fields: [quotations.originalQuotationId],
    references: [quotations.id],
    relationName: "quotationRevisions",
  }),
  revisions: many(quotations, {
    relationName: "quotationRevisions",
  }),
}));

export const quotationItemsRelations = relations(quotationItems, ({ one }) => ({
  quotation: one(quotations, {
    fields: [quotationItems.quotationId],
    references: [quotations.id],
  }),
  inventoryItem: one(inventoryItems, {
    fields: [quotationItems.itemId],
    references: [inventoryItems.id],
  }),
}));

export const projectCostsRelations = relations(projectCosts, ({ one }) => ({
  project: one(projects, {
    fields: [projectCosts.projectId],
    references: [projects.id],
  }),
  inventoryItem: one(inventoryItems, {
    fields: [projectCosts.itemId],
    references: [inventoryItems.id],
  }),
  addedBy: one(users, {
    fields: [projectCosts.addedBy],
    references: [users.id],
  }),
  paymentMethod: one(paymentMethods, {
    fields: [projectCosts.paymentMethodId],
    references: [paymentMethods.id],
  }),
}));

export const projectRemarksRelations = relations(projectRemarks, ({ one }) => ({
  project: one(projects, {
    fields: [projectRemarks.projectId],
    references: [projects.id],
  }),
  author: one(users, {
    fields: [projectRemarks.authorId],
    references: [users.id],
  }),
}));

export const warrantyAlertsRelations = relations(warrantyAlerts, ({ one }) => ({
  project: one(projects, {
    fields: [warrantyAlerts.projectId],
    references: [projects.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const projectInvoicesRelations = relations(projectInvoices, ({ one, many }) => ({
  project: one(projects, {
    fields: [projectInvoices.projectId],
    references: [projects.id],
  }),
  customer: one(customers, {
    fields: [projectInvoices.customerId],
    references: [customers.id],
  }),
  postedEntry: one(journalEntries, {
    fields: [projectInvoices.postedEntryId],
    references: [journalEntries.id],
  }),
  createdBy: one(users, {
    fields: [projectInvoices.createdBy],
    references: [users.id],
  }),
  lines: many(projectInvoiceLines),
  allocations: many(projectPaymentAllocations),
  vouchers: many(projectVouchers),
}));

export const projectInvoiceLinesRelations = relations(projectInvoiceLines, ({ one }) => ({
  invoice: one(projectInvoices, {
    fields: [projectInvoiceLines.invoiceId],
    references: [projectInvoices.id],
  }),
}));

export const projectPaymentAllocationsRelations = relations(
  projectPaymentAllocations,
  ({ one }) => ({
    payment: one(projectPayments, {
      fields: [projectPaymentAllocations.paymentId],
      references: [projectPayments.id],
    }),
    invoice: one(projectInvoices, {
      fields: [projectPaymentAllocations.invoiceId],
      references: [projectInvoices.id],
    }),
  }),
);

export const projectVouchersRelations = relations(projectVouchers, ({ one }) => ({
  project: one(projects, {
    fields: [projectVouchers.projectId],
    references: [projects.id],
  }),
  invoice: one(projectInvoices, {
    fields: [projectVouchers.invoiceId],
    references: [projectInvoices.id],
  }),
  createdBy: one(users, {
    fields: [projectVouchers.createdBy],
    references: [users.id],
  }),
}));

export const paymentMethodsRelations = relations(paymentMethods, ({ many }) => ({
  payments: many(projectPayments),
  generalExpenses: many(generalExpenses),
}));

export const ledgerAccountsRelations = relations(ledgerAccounts, ({ many }) => ({
  lines: many(journalLines),
  generalExpenses: many(generalExpenses),
}));

export const journalEntriesRelations = relations(journalEntries, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [journalEntries.createdBy],
    references: [users.id],
  }),
  lines: many(journalLines),
}));

export const journalLinesRelations = relations(journalLines, ({ one }) => ({
  entry: one(journalEntries, {
    fields: [journalLines.entryId],
    references: [journalEntries.id],
  }),
  account: one(ledgerAccounts, {
    fields: [journalLines.accountId],
    references: [ledgerAccounts.id],
  }),
  project: one(projects, {
    fields: [journalLines.projectId],
    references: [projects.id],
  }),
}));

export const projectPaymentsRelations = relations(projectPayments, ({ one, many }) => ({
  project: one(projects, {
    fields: [projectPayments.projectId],
    references: [projects.id],
  }),
  voucher: one(projectVouchers, {
    fields: [projectPayments.voucherId],
    references: [projectVouchers.id],
  }),
  paymentMethod: one(paymentMethods, {
    fields: [projectPayments.paymentMethodId],
    references: [paymentMethods.id],
  }),
  createdBy: one(users, {
    fields: [projectPayments.createdBy],
    references: [users.id],
  }),
  allocations: many(projectPaymentAllocations),
}));

// Update projects relations to include vouchers and payments
export const projectsRelations = relations(projects, ({ one, many }) => ({
  quotation: one(quotations, {
    fields: [projects.quotationId],
    references: [quotations.id],
  }),
  customer: one(customers, {
    fields: [projects.customerId],
    references: [customers.id],
  }),
  costs: many(projectCosts),
  remarks: many(projectRemarks),
  warrantyAlerts: many(warrantyAlerts),
  invoices: many(projectInvoices),
  vouchers: many(projectVouchers),
  payments: many(projectPayments),
  journalLines: many(journalLines),
  changeOrders: many(projectChangeOrders),
}));

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  purchaseOrders: many(purchaseOrders),
  payments: many(supplierPayments),
}));

export const purchaseOrdersRelations = relations(purchaseOrders, ({ one, many }) => ({
  supplier: one(suppliers, {
    fields: [purchaseOrders.supplierId],
    references: [suppliers.id],
  }),
  createdBy: one(users, {
    fields: [purchaseOrders.createdBy],
    references: [users.id],
  }),
  items: many(purchaseOrderItems),
  payments: many(supplierPayments),
}));

export const purchaseOrderItemsRelations = relations(purchaseOrderItems, ({ one }) => ({
  purchaseOrder: one(purchaseOrders, {
    fields: [purchaseOrderItems.purchaseOrderId],
    references: [purchaseOrders.id],
  }),
  item: one(inventoryItems, {
    fields: [purchaseOrderItems.itemId],
    references: [inventoryItems.id],
  }),
}));

export const supplierPaymentsRelations = relations(supplierPayments, ({ one }) => ({
  purchaseOrder: one(purchaseOrders, {
    fields: [supplierPayments.purchaseOrderId],
    references: [purchaseOrders.id],
  }),
  supplier: one(suppliers, {
    fields: [supplierPayments.supplierId],
    references: [suppliers.id],
  }),
  paymentMethod: one(paymentMethods, {
    fields: [supplierPayments.paymentMethodId],
    references: [paymentMethods.id],
  }),
  createdBy: one(users, {
    fields: [supplierPayments.createdBy],
    references: [users.id],
  }),
}));

export const accountingPeriodsRelations = relations(accountingPeriods, ({ one }) => ({
  closedBy: one(users, {
    fields: [accountingPeriods.closedBy],
    references: [users.id],
  }),
}));

export const generalExpensesRelations = relations(generalExpenses, ({ one }) => ({
  account: one(ledgerAccounts, {
    fields: [generalExpenses.accountId],
    references: [ledgerAccounts.id],
  }),
  paymentMethod: one(paymentMethods, {
    fields: [generalExpenses.paymentMethodId],
    references: [paymentMethods.id],
  }),
  createdBy: one(users, {
    fields: [generalExpenses.createdBy],
    references: [users.id],
  }),
}));

export const ownersRelations = relations(owners, ({ one, many }) => ({
  user: one(users, {
    fields: [owners.userId],
    references: [users.id],
  }),
  transactions: many(ownerTransactions),
}));

export const ownerTransactionsRelations = relations(ownerTransactions, ({ one }) => ({
  owner: one(owners, {
    fields: [ownerTransactions.ownerId],
    references: [owners.id],
  }),
  journalEntry: one(journalEntries, {
    fields: [ownerTransactions.journalEntryId],
    references: [journalEntries.id],
  }),
}));

// --- Idempotency ---

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    key: text("key").primaryKey(),
    response: jsonb("response").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("idempotency_keys_created_at_idx").on(table.createdAt)],
);

// --- Audit Logs ---

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    action: auditActionEnum("action").notNull(),
    details: jsonb("details"),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("audit_logs_user_id_idx").on(table.userId),
    index("audit_logs_action_idx").on(table.action),
    index("audit_logs_created_at_idx").on(table.createdAt),
  ],
);

export const projectChangeOrdersRelations = relations(projectChangeOrders, ({ one, many }) => ({
  project: one(projects, {
    fields: [projectChangeOrders.projectId],
    references: [projects.id],
  }),
  originalQuotation: one(quotations, {
    fields: [projectChangeOrders.originalQuotationId],
    references: [quotations.id],
  }),
  approvedBy: one(users, {
    fields: [projectChangeOrders.approvedBy],
    references: [users.id],
  }),
  createdBy: one(users, {
    fields: [projectChangeOrders.createdBy],
    references: [users.id],
  }),
  items: many(projectChangeOrderItems),
}));

export const projectChangeOrderItemsRelations = relations(projectChangeOrderItems, ({ one }) => ({
  changeOrder: one(projectChangeOrders, {
    fields: [projectChangeOrderItems.changeOrderId],
    references: [projectChangeOrders.id],
  }),
  inventoryItem: one(inventoryItems, {
    fields: [projectChangeOrderItems.itemId],
    references: [inventoryItems.id],
  }),
}));

// --- Types ---

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

export type AuthRateLimit = InferSelectModel<typeof authRateLimits>;
export type NewAuthRateLimit = InferInsertModel<typeof authRateLimits>;

export type Customer = InferSelectModel<typeof customers>;
export type NewCustomer = InferInsertModel<typeof customers>;

export type InventoryItem = InferSelectModel<typeof inventoryItems>;
export type NewInventoryItem = InferInsertModel<typeof inventoryItems>;

export type Quotation = InferSelectModel<typeof quotations>;
export type NewQuotation = InferInsertModel<typeof quotations>;

export type QuotationItem = InferSelectModel<typeof quotationItems>;
export type NewQuotationItem = InferInsertModel<typeof quotationItems>;

export type Project = InferSelectModel<typeof projects>;
export type NewProject = InferInsertModel<typeof projects>;

export type ProjectChangeOrder = InferSelectModel<typeof projectChangeOrders>;
export type NewProjectChangeOrder = InferInsertModel<typeof projectChangeOrders>;

export type ProjectChangeOrderItem = InferSelectModel<typeof projectChangeOrderItems>;
export type NewProjectChangeOrderItem = InferInsertModel<typeof projectChangeOrderItems>;

export type ProjectCost = InferSelectModel<typeof projectCosts>;
export type NewProjectCost = InferInsertModel<typeof projectCosts>;

export type ProjectRemark = InferSelectModel<typeof projectRemarks>;
export type NewProjectRemark = InferInsertModel<typeof projectRemarks>;

export type WarrantyAlert = InferSelectModel<typeof warrantyAlerts>;
export type NewWarrantyAlert = InferInsertModel<typeof warrantyAlerts>;

export type Notification = InferSelectModel<typeof notifications>;
export type NewNotification = InferInsertModel<typeof notifications>;

export type CompanySetting = InferSelectModel<typeof companySettings>;
export type NewCompanySetting = InferInsertModel<typeof companySettings>;

export type ProjectInvoice = InferSelectModel<typeof projectInvoices>;
export type NewProjectInvoice = InferInsertModel<typeof projectInvoices>;

export type ProjectInvoiceLine = InferSelectModel<typeof projectInvoiceLines>;
export type NewProjectInvoiceLine = InferInsertModel<typeof projectInvoiceLines>;

export type ProjectPaymentAllocation = InferSelectModel<typeof projectPaymentAllocations>;
export type NewProjectPaymentAllocation = InferInsertModel<typeof projectPaymentAllocations>;

export type ProjectVoucher = InferSelectModel<typeof projectVouchers>;
export type NewProjectVoucher = InferInsertModel<typeof projectVouchers>;

export type PaymentMethod = InferSelectModel<typeof paymentMethods>;
export type NewPaymentMethod = InferInsertModel<typeof paymentMethods>;

export type ProjectPayment = InferSelectModel<typeof projectPayments>;
export type NewProjectPayment = InferInsertModel<typeof projectPayments>;

export type LedgerAccount = InferSelectModel<typeof ledgerAccounts>;
export type NewLedgerAccount = InferInsertModel<typeof ledgerAccounts>;

export type JournalEntry = InferSelectModel<typeof journalEntries>;
export type NewJournalEntry = InferInsertModel<typeof journalEntries>;

export type JournalLine = InferSelectModel<typeof journalLines>;
export type NewJournalLine = InferInsertModel<typeof journalLines>;

export type Supplier = InferSelectModel<typeof suppliers>;
export type NewSupplier = InferInsertModel<typeof suppliers>;

export type PurchaseOrder = InferSelectModel<typeof purchaseOrders>;
export type NewPurchaseOrder = InferInsertModel<typeof purchaseOrders>;

export type PurchaseOrderItem = InferSelectModel<typeof purchaseOrderItems>;
export type NewPurchaseOrderItem = InferInsertModel<typeof purchaseOrderItems>;

export type SupplierPayment = InferSelectModel<typeof supplierPayments>;
export type NewSupplierPayment = InferInsertModel<typeof supplierPayments>;

export type Budget = InferSelectModel<typeof budgets>;
export type NewBudget = InferInsertModel<typeof budgets>;

export type AccountingPeriod = InferSelectModel<typeof accountingPeriods>;
export type NewAccountingPeriod = InferInsertModel<typeof accountingPeriods>;

export type IdempotencyKey = InferSelectModel<typeof idempotencyKeys>;
export type NewIdempotencyKey = InferInsertModel<typeof idempotencyKeys>;

export type GeneralExpense = InferSelectModel<typeof generalExpenses>;
export type NewGeneralExpense = InferInsertModel<typeof generalExpenses>;

export type Owner = InferSelectModel<typeof owners>;
export type NewOwner = InferInsertModel<typeof owners>;

export type OwnerTransaction = InferSelectModel<typeof ownerTransactions>;
export type NewOwnerTransaction = InferInsertModel<typeof ownerTransactions>;

export type AuditLog = InferSelectModel<typeof auditLogs>;
export type NewAuditLog = InferInsertModel<typeof auditLogs>;
