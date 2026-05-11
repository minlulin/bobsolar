import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { and, eq, like } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  customers,
  inventoryItems,
  notifications,
  projectCosts,
  projectRemarks,
  projects,
  quotationItems,
  quotations,
  users,
  warrantyAlerts,
} from '@/lib/db/schema';
import { createCustomer } from '@/actions/customer-actions';
import { createInventoryItem } from '@/actions/inventory-actions';
import {
  createQuotation,
  getQuotation,
  updateQuotationStatus,
} from '@/actions/quotation-actions';
import {
  addProjectCost,
  addProjectRemark,
  convertQuotationToProject,
  getProject,
  markProjectCompleted,
} from '@/actions/project-actions';
import {
  getWarrantyAlerts,
  reopenWarrantyAlert,
  resolveWarrantyAlert,
} from '@/actions/warranty-actions';
import {
  getDashboardPipeline,
  getDashboardStats,
  getRecentActivity,
  getUpcomingAlerts,
} from '@/actions/dashboard-actions';
import {
  getNotificationsWithFilter,
  markAllNotificationsAsRead,
  runScheduledNotificationChecks,
} from '@/actions/notification-actions';

const authState = vi.hoisted(() => ({
  userId: '',
  role: 'admin' as const,
}));

vi.mock('@/lib/auth/validate', () => ({
  requireAuth: async (): Promise<{ userId: string; role: 'admin' | 'staff' }> => {
    if (!authState.userId) {
      throw new Error('Auth context not initialized');
    }
    return await Promise.resolve({
      userId: authState.userId,
      role: authState.role,
    });
  },
  requireAdmin: async (): Promise<{ userId: string; role: 'admin' }> => {
    if (!authState.userId) {
      throw new Error('Auth context not initialized');
    }
    return await Promise.resolve({
      userId: authState.userId,
      role: authState.role,
    });
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

const databaseUrl = process.env['DATABASE_URL'] ?? '';
const describeDb = databaseUrl ? describe : describe.skip;

function unwrap<T>(result: { success: boolean; data?: T; error?: string }): T {
  if (!result.success) {
    throw new Error(result.error ?? 'Action failed');
  }
  return result.data as T;
}

describeDb('Master workflow integration: DB + server actions', () => {
  const runTag = `wf-${Date.now()}`;
  let adminUserId = '';
  let staffUserId = '';
  let customerId = '';
  let inventoryId = '';
  let quotationId = '';
  let projectId = '';
  let warrantyAlertId = '';

  beforeAll(async () => {
    try {
      await db.execute('select 1');
    } catch (error) {
      throw new Error(
        `Cannot connect to test database via DATABASE_URL (mapped from TEST_DATABASE_URL in vitest). ${String(error)}`,
      );
    }

    const adminEmail = `${runTag}-admin@example.com`;
    const staffEmail = `${runTag}-staff@example.com`;

    const [adminRow] = await db
      .insert(users)
      .values({
        email: adminEmail,
        passwordHash: 'test_hash',
        name: 'Workflow Admin',
        role: 'admin',
      })
      .returning({ id: users.id });

    const [staffRow] = await db
      .insert(users)
      .values({
        email: staffEmail,
        passwordHash: 'test_hash',
        name: 'Workflow Staff',
        role: 'staff',
      })
      .returning({ id: users.id });

    if (!adminRow?.id || !staffRow?.id) {
      throw new Error('Failed to create workflow test users');
    }

    adminUserId = adminRow.id;
    staffUserId = staffRow.id;
    authState.userId = adminUserId;
    authState.role = 'admin';
  });

  afterAll(async () => {
    if (projectId) {
      await db
        .delete(projectRemarks)
        .where(eq(projectRemarks.projectId, projectId));
      await db
        .delete(projectCosts)
        .where(eq(projectCosts.projectId, projectId));
      await db
        .delete(warrantyAlerts)
        .where(eq(warrantyAlerts.projectId, projectId));
      await db.delete(projects).where(eq(projects.id, projectId));
    }
    if (quotationId) {
      await db
        .delete(quotationItems)
        .where(eq(quotationItems.quotationId, quotationId));
      await db.delete(quotations).where(eq(quotations.id, quotationId));
    }
    if (inventoryId) {
      await db.delete(inventoryItems).where(eq(inventoryItems.id, inventoryId));
    }
    if (customerId) {
      await db.delete(customers).where(eq(customers.id, customerId));
    }

    await db
      .delete(notifications)
      .where(like(notifications.title, 'Project completed%'));
    await db
      .delete(notifications)
      .where(like(notifications.title, 'Alert resolved%'));
    await db
      .delete(notifications)
      .where(like(notifications.title, 'New warranty alert%'));

    if (adminUserId || staffUserId) {
      await db
        .delete(notifications)
        .where(
          and(
            like(notifications.message, `%${runTag}%`),
            eq(notifications.isRead, true),
          ),
        );
      await db.delete(users).where(eq(users.id, adminUserId));
      await db.delete(users).where(eq(users.id, staffUserId));
    }
  });

  it('runs the business workflow from customer to completed project', async () => {
    const createdCustomer = unwrap(
      await createCustomer({
        name: `${runTag} Customer`,
        phone: '09-000111222',
        email: `${runTag}@customer.com`,
        address: 'Yangon',
        city: 'Yangon',
      }),
    );
    customerId = createdCustomer.id;

    const createdInventory = unwrap(
      await createInventoryItem({
        name: `${runTag} Panel`,
        category: 'panel',
        unit: 'pcs',
        unitPrice: 350000,
        stockQty: 50,
        brand: 'BOB',
        modelNumber: 'P400',
        isActive: true,
      }),
    );
    inventoryId = createdInventory.id;

    const createdQuotation = unwrap(
      await createQuotation({
        customerId,
        items: [
          {
            itemId: inventoryId,
            description: 'Panel 400W',
            quantity: 4,
            unitPrice: 350000,
            discountPercentage: 0,
          },
        ],
        discountPercent: 5,
        taxPercent: 5,
        notes: `${runTag} quotation`,
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }),
    );
    quotationId = createdQuotation.id;

    const quotationDetail = unwrap(await getQuotation(quotationId));
    expect(quotationDetail.items.length).toBe(1);
    expect(Number(quotationDetail.total)).toBeGreaterThan(0);

    unwrap(await updateQuotationStatus(quotationId, 'sent'));
    unwrap(await updateQuotationStatus(quotationId, 'accepted'));

    const createdProject = unwrap(
      await convertQuotationToProject({
        quotationId,
        siteAddress: `${runTag} Site`,
        systemSizeKwp: 5.5,
        notes: `${runTag} project`,
      }),
    );
    projectId = createdProject.id;

    const costs = unwrap(
      await addProjectCost({
        projectId,
        itemId: inventoryId,
        description: `${runTag} install labor`,
        amount: 100000,
        costType: 'labor',
        incurredDate: new Date(),
      }),
    );
    expect(costs.length).toBeGreaterThan(0);

    const remarks = unwrap(
      await addProjectRemark({
        projectId,
        content: `${runTag} first remark`,
        remarkType: 'note',
      }),
    );
    expect(remarks.length).toBeGreaterThan(0);

    const projectDetail = unwrap(await getProject(projectId));
    expect(projectDetail.costs.length).toBeGreaterThan(0);
    expect(projectDetail.remarks.length).toBeGreaterThan(0);

    unwrap(await markProjectCompleted(projectId));

    const allAlerts = unwrap(await getWarrantyAlerts({ tab: 'all' }));
    const projectAlerts = allAlerts.filter((a) => a.projectId === projectId);
    expect(projectAlerts.length).toBeGreaterThanOrEqual(3);
    warrantyAlertId = projectAlerts[0]?.id ?? '';

    unwrap(await resolveWarrantyAlert(warrantyAlertId));
    unwrap(await reopenWarrantyAlert(warrantyAlertId));

    const scheduled = unwrap(await runScheduledNotificationChecks());
    expect(scheduled.expiringQuotes).toBeGreaterThanOrEqual(0);
    expect(scheduled.dueSoonAlerts).toBeGreaterThanOrEqual(0);
    expect(scheduled.overdueAlerts).toBeGreaterThanOrEqual(0);

    const stats = unwrap(await getDashboardStats());
    expect(stats.totalCustomers).toBeGreaterThanOrEqual(1);
    expect(stats.pendingQuotationsCount).toBeGreaterThanOrEqual(0);

    const pipeline = unwrap(await getDashboardPipeline());
    expect(pipeline.stages.length).toBe(4);

    const activity = unwrap(await getRecentActivity(10));
    expect(activity.length).toBeGreaterThan(0);

    const upcoming = unwrap(await getUpcomingAlerts(10));
    expect(upcoming.length).toBeGreaterThan(0);

    const unread = unwrap(
      await getNotificationsWithFilter({ unreadOnly: true }),
    );
    expect(Array.isArray(unread)).toBe(true);
    unwrap(await markAllNotificationsAsRead());
  });
});
