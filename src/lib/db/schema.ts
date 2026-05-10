import {
  pgTable,
  uuid,
  text,
  timestamp,
  decimal,
  integer,
  boolean,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import {
  relations,
  sql,
  type InferSelectModel,
  type InferInsertModel,
} from 'drizzle-orm';

// --- Enums ---

export const userRoleEnum = pgEnum('user_role', ['admin', 'staff']);

export const inventoryCategoryEnum = pgEnum('inventory_category', [
  'panel',
  'inverter',
  'battery',
  'mounting',
  'cable',
  'accessory',
  'labor',
]);

export type InventoryCategory =
  (typeof inventoryCategoryEnum.enumValues)[number];

export const inventoryUnitEnum = pgEnum('inventory_unit', [
  'pcs',
  'meter',
  'set',
  'kWp',
  'job',
]);

export type InventoryUnit = (typeof inventoryUnitEnum.enumValues)[number];

export const quotationStatusEnum = pgEnum('quotation_status', [
  'draft',
  'sent',
  'accepted',
  'rejected',
  'expired',
]);

export type QuotationStatus = (typeof quotationStatusEnum.enumValues)[number];

export const projectStatusEnum = pgEnum('project_status', [
  'planning',
  'in_progress',
  'on_hold',
  'completed',
  'cancelled',
]);

export const costTypeEnum = pgEnum('cost_type', [
  'material',
  'labor',
  'transport',
  'misc',
]);

export const remarkTypeEnum = pgEnum('remark_type', [
  'note',
  'issue',
  'update',
]);

export const alertTypeEnum = pgEnum('alert_type', [
  'warranty_expiry',
  'maintenance_due',
  'follow_up',
]);

export const notificationTypeEnum = pgEnum('notification_type', [
  'info',
  'warning',
  'action',
]);

// --- Tables ---

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  role: userRoleEnum('role').default('staff').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(), // crypto.randomUUID()
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  role: text('role').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const customers = pgTable('customers', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone').notNull(),
  address: text('address'),
  city: text('city'),
  notes: text('notes'),
  isArchived: boolean('is_archived').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const inventoryItems = pgTable('inventory_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  category: inventoryCategoryEnum('category').notNull(),
  unit: inventoryUnitEnum('unit').notNull(),
  unitPrice: decimal('unit_price', { precision: 15, scale: 0 }).notNull(),
  stockQty: integer('stock_qty').default(0).notNull(),
  brand: text('brand'),
  modelNumber: text('model_number'),
  isActive: boolean('is_active').default(true).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const quotations = pgTable(
  'quotations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    quoteNumber: text('quote_number').unique().notNull(), // QT-2026-0001
    customerId: uuid('customer_id')
      .references(() => customers.id, { onDelete: 'cascade' })
      .notNull(),
    createdBy: uuid('created_by')
      .references(() => users.id)
      .notNull(),
    status: quotationStatusEnum('status').default('draft').notNull(),
    subtotal: decimal('subtotal', { precision: 15, scale: 0 }).notNull(),
    discountPercent: decimal('discount_percent', {
      precision: 5,
      scale: 2,
    })
      .default('0')
      .notNull(),
    discountAmount: decimal('discount_amount', {
      precision: 15,
      scale: 0,
    })
      .default('0')
      .notNull(),
    taxPercent: decimal('tax_percent', { precision: 5, scale: 2 })
      .default('0')
      .notNull(),
    taxAmount: decimal('tax_amount', { precision: 15, scale: 0 })
      .default('0')
      .notNull(),
    total: decimal('total', { precision: 15, scale: 0 }).notNull(),
    notes: text('notes'),
    validUntil: timestamp('valid_until'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('quotations_status_created_at_idx').on(table.status, table.createdAt),
    index('quotations_customer_id_idx').on(table.customerId),
    index('quotations_created_by_idx').on(table.createdBy),
  ],
);

export const quotationItems = pgTable('quotation_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  quotationId: uuid('quotation_id')
    .references(() => quotations.id, { onDelete: 'cascade' })
    .notNull(),
  itemId: uuid('item_id').references(() => inventoryItems.id),
  description: text('description').notNull(),
  quantity: decimal('quantity', { precision: 12, scale: 2 }).notNull(),
  discountPercentage: decimal('discount_percentage', {
    precision: 5,
    scale: 2,
  }).default('0'),
  unitPrice: decimal('unit_price', { precision: 15, scale: 0 }).notNull(), // Snapshot
  totalPrice: decimal('total_price', { precision: 15, scale: 0 }).notNull(),
  sortOrder: integer('sort_order').notNull(),
});

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectNumber: text('project_number').unique().notNull(), // PJ-2026-0001
    quotationId: uuid('quotation_id').references(() => quotations.id),
    customerId: uuid('customer_id')
      .references(() => customers.id)
      .notNull(),
    status: projectStatusEnum('status').default('planning').notNull(),
    siteAddress: text('site_address').notNull(),
    systemSizeKwp: decimal('system_size_kwp', {
      precision: 10,
      scale: 2,
    }).notNull(),
    quotedTotal: decimal('quoted_total', { precision: 15, scale: 0 }).notNull(),
    actualTotal: decimal('actual_total', {
      precision: 15,
      scale: 0,
    }).default('0'),
    startDate: timestamp('start_date'),
    targetCompletion: timestamp('target_completion'),
    actualCompletion: timestamp('actual_completion'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    // Unique constraint: one project per quotation (where quotation_id is not null)
    uniqueIndex('projects_quotation_id_unique')
      .on(table.quotationId)
      .where(sql`${table.quotationId} is not null`),
    index('projects_status_created_at_idx').on(table.status, table.createdAt),
    index('projects_customer_id_idx').on(table.customerId),
    index('projects_quotation_id_idx').on(table.quotationId),
  ],
);

export const projectCosts = pgTable('project_costs', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull(),
  itemId: uuid('item_id').references(() => inventoryItems.id),
  description: text('description').notNull(),
  amount: decimal('amount', { precision: 15, scale: 0 }).notNull(),
  costType: costTypeEnum('cost_type').notNull(),
  incurredDate: timestamp('incurred_date').defaultNow().notNull(),
  addedBy: uuid('added_by')
    .references(() => users.id)
    .notNull(),
});

export const projectRemarks = pgTable('project_remarks', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull(),
  authorId: uuid('author_id')
    .references(() => users.id)
    .notNull(),
  content: text('content').notNull(),
  remarkType: remarkTypeEnum('remark_type').default('note').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const warrantyAlerts = pgTable(
  'warranty_alerts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .references(() => projects.id, { onDelete: 'cascade' })
      .notNull(),
    alertType: alertTypeEnum('alert_type').notNull(),
    description: text('description').notNull(),
    dueDate: timestamp('due_date').notNull(),
    isResolved: boolean('is_resolved').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('warranty_alerts_resolved_due_date_idx').on(
      table.isResolved,
      table.dueDate,
    ),
    index('warranty_alerts_project_id_idx').on(table.projectId),
  ],
);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    message: text('message').notNull(),
    type: notificationTypeEnum('type').default('info').notNull(),
    link: text('link'),
    isRead: boolean('is_read').default(false).notNull(),
    notificationDedupeKey: text('notification_dedupe_key'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('notifications_user_read_created_at_idx').on(
      table.userId,
      table.isRead,
      table.createdAt,
    ),
    index('notifications_user_created_at_idx').on(
      table.userId,
      table.createdAt,
    ),
    index('notifications_dedupe_key_idx').on(table.notificationDedupeKey),
  ],
);

export const companySettings = pgTable('company_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

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

export const inventoryItemsRelations = relations(
  inventoryItems,
  ({ many }) => ({
    quotationItems: many(quotationItems),
    projectCosts: many(projectCosts),
  }),
);

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

// --- Types ---

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

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
