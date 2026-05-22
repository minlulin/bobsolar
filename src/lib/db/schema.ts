import { type InferInsertModel, type InferSelectModel, relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
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

export const userRoleEnum = pgEnum("user_role", ["admin", "staff"]);

export const inventoryCategoryEnum = pgEnum("inventory_category", [
  "panel",
  "inverter",
  "battery",
  "mounting",
  "cable",
  "accessory",
  "labor",
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

export const costTypeEnum = pgEnum("cost_type", ["material", "labor", "transport", "misc"]);

export const remarkTypeEnum = pgEnum("remark_type", ["note", "issue", "update"]);

export const alertTypeEnum = pgEnum("alert_type", [
  "warranty_expiry",
  "maintenance_due",
  "follow_up",
]);

export const notificationTypeEnum = pgEnum("notification_type", ["info", "warning", "action"]);

export const voucherTypeEnum = pgEnum("voucher_type", [
  "completion_certificate",
  "final_payment_voucher",
]);

export const ledgerAccountTypeEnum = pgEnum("ledger_account_type", [
  "asset",
  "liability",
  "equity",
  "income",
  "expense",
]);

export const journalSourceTypeEnum = pgEnum("journal_source_type", [
  "project_payment",
  "project_expense",
  "manual_adjustment",
  "opening_balance",
  "backfill",
]);

// --- Tables ---

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: userRoleEnum("role").default("staff").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(), // crypto.randomUUID()
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  role: text("role").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
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

export const inventoryItems = pgTable("inventory_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  category: inventoryCategoryEnum("category").notNull(),
  unit: inventoryUnitEnum("unit").notNull(),
  unitPrice: decimal("unit_price", { precision: 15, scale: 2 }).notNull(),
  stockQty: integer("stock_qty").default(0).notNull(),
  brand: text("brand"),
  modelNumber: text("model_number"),
  specifications: jsonb("specifications"),
  isActive: boolean("is_active").default(true).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

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
    isArchived: boolean("is_archived").default(false).notNull(),
    archivedAt: timestamp("archived_at"),
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
      .references(() => quotations.id, { onDelete: "cascade" })
      .notNull(),
    itemId: uuid("item_id").references(() => inventoryItems.id),
    description: text("description").notNull(),
    quantity: decimal("quantity", { precision: 12, scale: 2 }).notNull(),
    discountPercentage: decimal("discount_percentage", {
      precision: 5,
      scale: 2,
    }).default("0"),
    unitPrice: decimal("unit_price", { precision: 15, scale: 2 }).notNull(), // Snapshot
    totalPrice: decimal("total_price", { precision: 15, scale: 2 }).notNull(),
    sortOrder: integer("sort_order").notNull(),
  },
  (table) => [index("quotation_items_quotation_id_idx").on(table.quotationId)],
);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectNumber: text("project_number").unique().notNull(), // PJ-2026-0001
    quotationId: uuid("quotation_id").references(() => quotations.id),
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
    actualTotal: decimal("actual_total", {
      precision: 15,
      scale: 2,
    }).default("0"),
    startDate: timestamp("start_date"),
    targetCompletion: timestamp("target_completion"),
    actualCompletion: timestamp("actual_completion"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
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
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    itemId: uuid("item_id").references(() => inventoryItems.id),
    paymentMethodId: uuid("payment_method_id").references(() => paymentMethods.id),
    description: text("description").notNull(),
    amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
    costType: costTypeEnum("cost_type").notNull(),
    incurredDate: timestamp("incurred_date").defaultNow().notNull(),
    addedBy: uuid("added_by")
      .references(() => users.id)
      .notNull(),
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
      .references(() => projects.id, { onDelete: "cascade" })
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

export const warrantyAlerts = pgTable(
  "warranty_alerts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
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

export const projectVouchers = pgTable(
  "project_vouchers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
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
  name: text("name").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const projectPayments = pgTable(
  "project_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
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
    index("journal_entries_entry_date_idx").on(table.entryDate),
    index("journal_entries_source_idx").on(table.sourceType, table.sourceId),
    index("journal_entries_created_by_idx").on(table.createdBy),
    index("journal_entries_is_reversed_idx").on(table.isReversed),
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

// --- Relations ---

export const usersRelations = relations(users, ({ many }) => ({
  quotations: many(quotations),
  projectCosts: many(projectCosts),
  projectRemarks: many(projectRemarks),
  notifications: many(notifications),
  sessions: many(sessions),
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

export const projectVouchersRelations = relations(projectVouchers, ({ one }) => ({
  project: one(projects, {
    fields: [projectVouchers.projectId],
    references: [projects.id],
  }),
  createdBy: one(users, {
    fields: [projectVouchers.createdBy],
    references: [users.id],
  }),
}));

export const paymentMethodsRelations = relations(paymentMethods, ({ many }) => ({
  payments: many(projectPayments),
}));

export const ledgerAccountsRelations = relations(ledgerAccounts, ({ many }) => ({
  lines: many(journalLines),
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

export const projectPaymentsRelations = relations(projectPayments, ({ one }) => ({
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
  vouchers: many(projectVouchers),
  payments: many(projectPayments),
  journalLines: many(journalLines),
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
