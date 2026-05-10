'use server';

import { db } from '@/lib/db';
import {
  customers,
  projects,
  quotations,
  users,
  warrantyAlerts,
} from '@/lib/db/schema';
import { requireAuth } from '@/lib/auth/validate';
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  lt,
  lte,
  sql,
} from 'drizzle-orm';
import { endOfMonth, startOfDay, startOfMonth, subMonths } from 'date-fns';
import type { ActionResponse } from './inventory-actions';
import { handleActionError } from '@/lib/utils/error';

export type DashboardStats = {
  userName: string;
  totalRevenue: number;
  activeProjectsCount: number;
  pendingQuotationsCount: number;
  acceptedThisMonth: number;
  totalCustomers: number;
  overdueAlertsCount: number;
  revenueTrendPercent: number;
  quotationConversionRate: number;
};

export type DashboardPipelineNode = {
  key: 'customers' | 'quotations' | 'projects' | 'completed';
  label: string;
  count: number;
  value: number;
  href: string;
};

export type ActivityItem = {
  type: 'quotation' | 'project' | 'customer' | 'alert';
  description: string;
  timestamp: Date;
  link: string;
};

export type UpcomingAlertItem = {
  id: string;
  projectNumber: string;
  description: string;
  dueDate: Date;
  alertType: 'warranty_expiry' | 'maintenance_due' | 'follow_up';
  isOverdue: boolean;
};

function toInt(value: unknown): number {
  return Number(value ?? 0);
}

export async function getDashboardStats(): Promise<
  ActionResponse<DashboardStats>
> {
  try {
    const auth = await requireAuth();

    const today = new Date();
    const thisMonthStart = startOfMonth(today);
    const thisMonthEnd = endOfMonth(today);
    const prevMonthStart = startOfMonth(subMonths(today, 1));
    const prevMonthEnd = endOfMonth(subMonths(today, 1));
    const startToday = startOfDay(today);

    const [totalRevenueRow] = await db
      .select({
        total: sql<string>`coalesce(sum(${projects.actualTotal}::numeric), 0)`,
      })
      .from(projects)
      .where(eq(projects.status, 'completed'));

    const [activeProjectsRow] = await db
      .select({ total: count() })
      .from(projects)
      .where(inArray(projects.status, ['planning', 'in_progress', 'on_hold']));

    const [pendingQuotesRow] = await db
      .select({ total: count() })
      .from(quotations)
      .where(inArray(quotations.status, ['draft', 'sent']));

    const [acceptedThisMonthRow] = await db
      .select({ total: count() })
      .from(quotations)
      .where(
        and(
          eq(quotations.status, 'accepted'),
          gte(quotations.updatedAt, thisMonthStart),
          lte(quotations.updatedAt, thisMonthEnd),
        ),
      );

    const [customersRow] = await db
      .select({ total: count() })
      .from(customers)
      .where(eq(customers.isArchived, false));

    const [overdueAlertsRow] = await db
      .select({ total: count() })
      .from(warrantyAlerts)
      .where(
        and(
          eq(warrantyAlerts.isResolved, false),
          lt(warrantyAlerts.dueDate, startToday),
        ),
      );

    const [viewer] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, auth.userId))
      .limit(1);

    const [thisMonthRevenueRow] = await db
      .select({
        total: sql<string>`coalesce(sum(${projects.actualTotal}::numeric), 0)`,
      })
      .from(projects)
      .where(
        and(
          eq(projects.status, 'completed'),
          gte(projects.actualCompletion, thisMonthStart),
          lte(projects.actualCompletion, thisMonthEnd),
        ),
      );

    const [prevMonthRevenueRow] = await db
      .select({
        total: sql<string>`coalesce(sum(${projects.actualTotal}::numeric), 0)`,
      })
      .from(projects)
      .where(
        and(
          eq(projects.status, 'completed'),
          gte(projects.actualCompletion, prevMonthStart),
          lte(projects.actualCompletion, prevMonthEnd),
        ),
      );

    const [acceptedTotalRow] = await db
      .select({ total: count() })
      .from(quotations)
      .where(eq(quotations.status, 'accepted'));

    const [sentTotalRow] = await db
      .select({ total: count() })
      .from(quotations)
      .where(eq(quotations.status, 'sent'));

    const thisMonthRevenue = Number(thisMonthRevenueRow?.total ?? 0);
    const prevMonthRevenue = Number(prevMonthRevenueRow?.total ?? 0);
    const revenueTrendPercent =
      prevMonthRevenue <= 0
        ? thisMonthRevenue > 0
          ? 100
          : 0
        : ((thisMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100;

    const acceptedTotal = toInt(acceptedTotalRow?.total);
    const sentTotal = toInt(sentTotalRow?.total);
    const quotationConversionRate =
      sentTotal <= 0 ? 0 : (acceptedTotal / sentTotal) * 100;

    return {
      success: true,
      data: {
        userName: viewer?.name ?? 'User',
        totalRevenue: Number(totalRevenueRow?.total ?? 0),
        activeProjectsCount: toInt(activeProjectsRow?.total),
        pendingQuotationsCount: toInt(pendingQuotesRow?.total),
        acceptedThisMonth: toInt(acceptedThisMonthRow?.total),
        totalCustomers: toInt(customersRow?.total),
        overdueAlertsCount: toInt(overdueAlertsRow?.total),
        revenueTrendPercent: Number(revenueTrendPercent.toFixed(1)),
        quotationConversionRate: Number(quotationConversionRate.toFixed(1)),
      },
    };
  } catch (error) {
    return handleActionError(
      error,
      'getDashboardStats',
      'Failed to fetch dashboard stats',
    );
  }
}

export async function getDashboardPipeline(): Promise<
  ActionResponse<{ stages: DashboardPipelineNode[] }>
> {
  try {
    await requireAuth();

    const [customersCountRow] = await db
      .select({ total: count() })
      .from(customers)
      .where(eq(customers.isArchived, false));

    const [activeQuoteCountRow] = await db
      .select({ total: count() })
      .from(quotations)
      .where(inArray(quotations.status, ['draft', 'sent']));

    const [activeQuoteValueRow] = await db
      .select({
        total: sql<string>`coalesce(sum(${quotations.total}::numeric), 0)`,
      })
      .from(quotations)
      .where(inArray(quotations.status, ['draft', 'sent']));

    const [activeProjectCountRow] = await db
      .select({ total: count() })
      .from(projects)
      .where(inArray(projects.status, ['planning', 'in_progress', 'on_hold']));

    const [activeProjectValueRow] = await db
      .select({
        total: sql<string>`coalesce(sum(${projects.quotedTotal}::numeric), 0)`,
      })
      .from(projects)
      .where(inArray(projects.status, ['planning', 'in_progress', 'on_hold']));

    const [completedCountRow] = await db
      .select({ total: count() })
      .from(projects)
      .where(eq(projects.status, 'completed'));

    const [completedValueRow] = await db
      .select({
        total: sql<string>`coalesce(sum(${projects.actualTotal}::numeric), 0)`,
      })
      .from(projects)
      .where(eq(projects.status, 'completed'));

    const stages: DashboardPipelineNode[] = [
      {
        key: 'customers',
        label: 'Customers',
        count: toInt(customersCountRow?.total),
        value: 0,
        href: '/customers',
      },
      {
        key: 'quotations',
        label: 'Active Quotes',
        count: toInt(activeQuoteCountRow?.total),
        value: Number(activeQuoteValueRow?.total ?? 0),
        href: '/quotations',
      },
      {
        key: 'projects',
        label: 'Active Projects',
        count: toInt(activeProjectCountRow?.total),
        value: Number(activeProjectValueRow?.total ?? 0),
        href: '/projects',
      },
      {
        key: 'completed',
        label: 'Completed',
        count: toInt(completedCountRow?.total),
        value: Number(completedValueRow?.total ?? 0),
        href: '/projects/completed',
      },
    ];

    return { success: true, data: { stages } };
  } catch (error) {
    return handleActionError(
      error,
      'getDashboardPipeline',
      'Failed to fetch dashboard pipeline',
    );
  }
}

export async function getRecentActivity(
  limit = 10,
): Promise<ActionResponse<ActivityItem[]>> {
  try {
    await requireAuth();

    const safeLimit = Math.max(1, Math.min(limit, 30));

    const quotationRows = await db
      .select({
        id: quotations.id,
        quoteNumber: quotations.quoteNumber,
        createdAt: quotations.createdAt,
      })
      .from(quotations)
      .orderBy(desc(quotations.createdAt))
      .limit(safeLimit);

    const projectRows = await db
      .select({
        id: projects.id,
        projectNumber: projects.projectNumber,
        status: projects.status,
        createdAt: projects.createdAt,
      })
      .from(projects)
      .orderBy(desc(projects.createdAt))
      .limit(safeLimit);

    const customerRows = await db
      .select({
        id: customers.id,
        name: customers.name,
        createdAt: customers.createdAt,
      })
      .from(customers)
      .where(eq(customers.isArchived, false))
      .orderBy(desc(customers.createdAt))
      .limit(safeLimit);

    const alertRows = await db
      .select({
        id: warrantyAlerts.id,
        projectId: warrantyAlerts.projectId,
        description: warrantyAlerts.description,
        dueDate: warrantyAlerts.dueDate,
        createdAt: warrantyAlerts.createdAt,
      })
      .from(warrantyAlerts)
      .where(eq(warrantyAlerts.isResolved, false))
      .orderBy(desc(warrantyAlerts.createdAt))
      .limit(safeLimit);

    const activities: ActivityItem[] = [
      ...quotationRows.map((row) => ({
        type: 'quotation' as const,
        description: `New quotation ${row.quoteNumber} created`,
        timestamp: row.createdAt,
        link: `/quotations/${row.id}`,
      })),
      ...projectRows.map((row) => ({
        type: 'project' as const,
        description:
          row.status === 'completed'
            ? `Project ${row.projectNumber} marked as completed`
            : `Project ${row.projectNumber} created`,
        timestamp: row.createdAt,
        link: `/projects/${row.id}`,
      })),
      ...customerRows.map((row) => ({
        type: 'customer' as const,
        description: `Customer ${row.name} added`,
        timestamp: row.createdAt,
        link: '/customers',
      })),
      ...alertRows.map((row) => ({
        type: 'alert' as const,
        description: `Warranty alert due: ${row.description}`,
        timestamp: row.createdAt,
        link: `/projects/${row.projectId}`,
      })),
    ];

    activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return { success: true, data: activities.slice(0, safeLimit) };
  } catch (error) {
    return handleActionError(
      error,
      'getRecentActivity',
      'Failed to fetch recent activity',
    );
  }
}

export async function getUpcomingAlerts(
  limit = 5,
): Promise<ActionResponse<UpcomingAlertItem[]>> {
  try {
    await requireAuth();
    const safeLimit = Math.max(1, Math.min(limit, 20));

    const rows = await db
      .select({
        id: warrantyAlerts.id,
        projectId: projects.id,
        projectNumber: projects.projectNumber,
        description: warrantyAlerts.description,
        dueDate: warrantyAlerts.dueDate,
        alertType: warrantyAlerts.alertType,
      })
      .from(warrantyAlerts)
      .innerJoin(projects, eq(warrantyAlerts.projectId, projects.id))
      .where(eq(warrantyAlerts.isResolved, false))
      .orderBy(asc(warrantyAlerts.dueDate))
      .limit(safeLimit);

    const today = startOfDay(new Date());
    const items: UpcomingAlertItem[] = rows.map((row) => ({
      id: row.id,
      projectNumber: row.projectNumber,
      description: row.description,
      dueDate: row.dueDate,
      alertType: row.alertType,
      isOverdue: row.dueDate.getTime() < today.getTime(),
    }));

    return { success: true, data: items };
  } catch (error) {
    return handleActionError(
      error,
      'getUpcomingAlerts',
      'Failed to fetch upcoming alerts',
    );
  }
}
