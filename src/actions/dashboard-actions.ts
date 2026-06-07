"use server";

import { endOfMonth, startOfDay, startOfMonth, subMonths } from "date-fns";
import { and, asc, count, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import { requireAuth } from "@/lib/auth/validate";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import type { AlertType } from "@/lib/db/schema";
import {
  customers,
  journalEntries,
  journalLines,
  ledgerAccounts,
  projectPayments,
  projects,
  quotations,
  users,
  warrantyAlerts,
} from "@/lib/db/schema";
import { CASH_ACCOUNT_CODES } from "@/lib/domain/finance";
import { type ActionResponse, successResponse } from "@/lib/utils/action-response";
import { handleActionError } from "@/lib/utils/error";

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
  key: "customers" | "quotations" | "projects" | "completed";
  label: string;
  count: number;
  value: number;
  href: string;
};

export type ActivityItem = {
  type: "quotation" | "project" | "customer" | "alert";
  description: string;
  timestamp: Date;
  link: string;
};

export type UpcomingAlertItem = {
  id: string;
  projectNumber: string;
  description: string;
  dueDate: Date;
  alertType: AlertType;
  isOverdue: boolean;
};

export type FinanceQuickView = {
  todayCashIn: number;
  todayCashOut: number;
  monthNetMovement: number;
  outstandingReceivableCount: number;
  outstandingReceivableAmount: number;
};

function toInt(value: unknown): number {
  return Number(value ?? 0);
}

const getCachedSharedStats = unstable_cache(
  async () => {
    const today = new Date();
    const thisMonthStart = startOfMonth(today);
    const thisMonthEnd = endOfMonth(today);
    const prevMonthStart = startOfMonth(subMonths(today, 1));
    const prevMonthEnd = endOfMonth(subMonths(today, 1));
    const startToday = startOfDay(today);

    const [[projectSummary], [quotationSummary], [customersRow], [overdueAlertsRow]] =
      await Promise.all([
        db
          .select({
            totalRevenue: sql<string>`coalesce(sum(${projects.quotedTotal}::numeric) filter (where ${projects.status} = 'completed'), 0)`,
            activeProjects: sql<number>`cast(count(*) filter (where ${projects.status} in ('planning', 'in_progress', 'on_hold')) as int)`,
            thisMonthRevenue: sql<string>`coalesce(sum(${projects.quotedTotal}::numeric) filter (where ${projects.status} = 'completed' and ${projects.actualCompletion} >= ${thisMonthStart} and ${projects.actualCompletion} <= ${thisMonthEnd}), 0)`,
            prevMonthRevenue: sql<string>`coalesce(sum(${projects.quotedTotal}::numeric) filter (where ${projects.status} = 'completed' and ${projects.actualCompletion} >= ${prevMonthStart} and ${projects.actualCompletion} <= ${prevMonthEnd}), 0)`,
          })
          .from(projects),
        db
          .select({
            pendingQuotes: sql<number>`cast(count(*) filter (where ${quotations.status} in ('draft', 'sent')) as int)`,
            acceptedThisMonth: sql<number>`cast(count(*) filter (where ${quotations.status} = 'accepted' and ${quotations.updatedAt} >= ${thisMonthStart} and ${quotations.updatedAt} <= ${thisMonthEnd}) as int)`,
            acceptedTotal: sql<number>`cast(count(*) filter (where ${quotations.status} = 'accepted') as int)`,
            sentTotal: sql<number>`cast(count(*) filter (where ${quotations.status} = 'sent') as int)`,
            rejectedTotal: sql<number>`cast(count(*) filter (where ${quotations.status} = 'rejected') as int)`,
            expiredTotal: sql<number>`cast(count(*) filter (where ${quotations.status} = 'expired') as int)`,
          })
          .from(quotations),
        db.select({ total: count() }).from(customers).where(eq(customers.isArchived, false)),
        db
          .select({ total: count() })
          .from(warrantyAlerts)
          .where(and(eq(warrantyAlerts.isResolved, false), lt(warrantyAlerts.dueDate, startToday))),
      ]);

    return {
      projectSummary,
      quotationSummary,
      customersRow,
      overdueAlertsRow,
    };
  },
  ["dashboard:shared-stats"],
  { tags: ["dashboard:stats"], revalidate: 60 },
);

export const getDashboardStats = cache(async (): Promise<ActionResponse<DashboardStats>> => {
  try {
    const auth = await requireAuth();

    const [viewer, shared] = await Promise.all([
      db.select({ name: users.name }).from(users).where(eq(users.id, auth.userId)).limit(1),
      getCachedSharedStats(),
    ]);

    const { projectSummary, quotationSummary, customersRow, overdueAlertsRow } = shared;

    const thisMonthRevenue = Number(projectSummary?.thisMonthRevenue ?? 0);
    const prevMonthRevenue = Number(projectSummary?.prevMonthRevenue ?? 0);
    const revenueTrendPercent =
      prevMonthRevenue <= 0
        ? thisMonthRevenue > 0
          ? 100
          : 0
        : ((thisMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100;

    const acceptedTotal = toInt(quotationSummary?.acceptedTotal);
    const rejectedTotal = toInt(quotationSummary?.rejectedTotal);
    const expiredTotal = toInt(quotationSummary?.expiredTotal);
    const sentTotal = toInt(quotationSummary?.sentTotal);
    const closedTotal = acceptedTotal + rejectedTotal + expiredTotal + sentTotal;
    const quotationConversionRate = closedTotal <= 0 ? 0 : (acceptedTotal / closedTotal) * 100;

    return successResponse({
      userName: viewer[0]?.name ?? "User",
      totalRevenue: Number(projectSummary?.totalRevenue ?? 0),
      activeProjectsCount: toInt(projectSummary?.activeProjects),
      pendingQuotationsCount: toInt(quotationSummary?.pendingQuotes),
      acceptedThisMonth: toInt(quotationSummary?.acceptedThisMonth),
      totalCustomers: toInt(customersRow?.total),
      overdueAlertsCount: toInt(overdueAlertsRow?.total),
      revenueTrendPercent: Number(revenueTrendPercent.toFixed(1)),
      quotationConversionRate: Number(quotationConversionRate.toFixed(1)),
    });
  } catch (error) {
    return handleActionError(error, "getDashboardStats", "Failed to fetch dashboard stats");
  }
});

export const getDashboardPipeline = cache(
  async (): Promise<ActionResponse<{ stages: DashboardPipelineNode[] }>> => {
    try {
      await requireAuth();

      const [[customersCountRow], [quotesSummary], [projectsSummary]] = await Promise.all([
        db.select({ total: count() }).from(customers).where(eq(customers.isArchived, false)),
        db
          .select({
            activeQuoteCount: sql<number>`cast(count(*) filter (where ${quotations.status} in ('draft', 'sent')) as int)`,
            activeQuoteValue: sql<string>`coalesce(sum(${quotations.total}::numeric) filter (where ${quotations.status} in ('draft', 'sent')), 0)`,
          })
          .from(quotations),
        db
          .select({
            activeProjectCount: sql<number>`cast(count(*) filter (where ${projects.status} in ('planning', 'in_progress', 'on_hold')) as int)`,
            activeProjectValue: sql<string>`coalesce(sum(${projects.quotedTotal}::numeric) filter (where ${projects.status} in ('planning', 'in_progress', 'on_hold')), 0)`,
            completedCount: sql<number>`cast(count(*) filter (where ${projects.status} = 'completed') as int)`,
            completedValue: sql<string>`coalesce(sum(${projects.quotedTotal}::numeric) filter (where ${projects.status} = 'completed'), 0)`,
          })
          .from(projects),
      ]);

      const stages: DashboardPipelineNode[] = [
        {
          key: "customers",
          label: "Customers",
          count: toInt(customersCountRow?.total),
          value: 0,
          href: "/customers",
        },
        {
          key: "quotations",
          label: "Active Quotes",
          count: toInt(quotesSummary?.activeQuoteCount),
          value: Number(quotesSummary?.activeQuoteValue ?? 0),
          href: "/quotations",
        },
        {
          key: "projects",
          label: "Active Projects",
          count: toInt(projectsSummary?.activeProjectCount),
          value: Number(projectsSummary?.activeProjectValue ?? 0),
          href: "/projects",
        },
        {
          key: "completed",
          label: "Completed",
          count: toInt(projectsSummary?.completedCount),
          value: Number(projectsSummary?.completedValue ?? 0),
          href: "/projects/completed",
        },
      ];

      return successResponse({ stages });
    } catch (error) {
      return handleActionError(error, "getDashboardPipeline", "Failed to fetch dashboard pipeline");
    }
  },
);

export const getRecentActivity = cache(
  async (limit = 10): Promise<ActionResponse<ActivityItem[]>> => {
    try {
      await requireAuth();

      const safeLimit = Math.max(1, Math.min(limit, 30));

      const [quotationRows, projectRows, customerRows, alertRows] = await Promise.all([
        db
          .select({
            id: quotations.id,
            quoteNumber: quotations.quoteNumber,
            createdAt: quotations.createdAt,
          })
          .from(quotations)
          .orderBy(desc(quotations.createdAt))
          .limit(safeLimit),
        db
          .select({
            id: projects.id,
            projectNumber: projects.projectNumber,
            status: projects.status,
            createdAt: projects.createdAt,
          })
          .from(projects)
          .orderBy(desc(projects.createdAt))
          .limit(safeLimit),
        db
          .select({
            id: customers.id,
            name: customers.name,
            createdAt: customers.createdAt,
          })
          .from(customers)
          .where(eq(customers.isArchived, false))
          .orderBy(desc(customers.createdAt))
          .limit(safeLimit),
        db
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
          .limit(safeLimit),
      ]);

      const activities: ActivityItem[] = [
        ...quotationRows.map((row) => ({
          type: "quotation" as const,
          description: `New quotation ${row.quoteNumber} created`,
          timestamp: row.createdAt,
          link: `/quotations/${row.id}`,
        })),
        ...projectRows.map((row) => ({
          type: "project" as const,
          description:
            row.status === "completed"
              ? `Project ${row.projectNumber} marked as completed`
              : `Project ${row.projectNumber} created`,
          timestamp: row.createdAt,
          link: `/projects/${row.id}`,
        })),
        ...customerRows.map((row) => ({
          type: "customer" as const,
          description: `Customer ${row.name} added`,
          timestamp: row.createdAt,
          link: "/customers",
        })),
        ...alertRows.map((row) => ({
          type: "alert" as const,
          description: `Warranty alert due: ${row.description}`,
          timestamp: row.createdAt,
          link: `/projects/${row.projectId}`,
        })),
      ];

      activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      return successResponse(activities.slice(0, safeLimit));
    } catch (error) {
      return handleActionError(error, "getRecentActivity", "Failed to fetch recent activity");
    }
  },
);

export const getUpcomingAlerts = cache(
  async (limit = 5): Promise<ActionResponse<UpcomingAlertItem[]>> => {
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

      return successResponse(items);
    } catch (error) {
      return handleActionError(error, "getUpcomingAlerts", "Failed to fetch upcoming alerts");
    }
  },
);

const getCachedFinanceQuickView = unstable_cache(
  async () => {
    const today = startOfDay(new Date());
    const monthStart = startOfMonth(new Date());
    const cashAccountCodes = CASH_ACCOUNT_CODES;

    const [financeRows, arRows] = await Promise.all([
      db
        .select({
          todayCashIn:
            sql<string>`coalesce(sum(${journalLines.debit}::numeric) filter (where ${journalEntries.entryDate} >= ${today}), 0)`.as(
              "today_cash_in",
            ),
          todayCashOut:
            sql<string>`coalesce(sum(${journalLines.credit}::numeric) filter (where ${journalEntries.entryDate} >= ${today}), 0)`.as(
              "today_cash_out",
            ),
          monthIncome: sql<string>`coalesce(sum(${journalLines.debit}::numeric), 0)`.as(
            "month_income",
          ),
          monthExpense: sql<string>`coalesce(sum(${journalLines.credit}::numeric), 0)`.as(
            "month_expense",
          ),
        })
        .from(journalEntries)
        .innerJoin(journalLines, eq(journalLines.entryId, journalEntries.id))
        .innerJoin(ledgerAccounts, eq(journalLines.accountId, ledgerAccounts.id))
        .where(
          and(
            gte(journalEntries.entryDate, monthStart),
            eq(journalEntries.isReversed, false),
            inArray(ledgerAccounts.code, cashAccountCodes),
          ),
        ),
      db
        .select({
          arCount: sql<number>`cast(count(*) filter (
            where (
              cast(${projects.quotedTotal} as numeric) - coalesce((
                select sum(cast(${projectPayments.amount} as numeric))
                from ${projectPayments}
                where ${projectPayments.projectId} = ${projects.id}
              ), 0)
            ) > 0
          ) as int)`.as("ar_count"),
          arAmount: sql<string>`coalesce(sum(greatest(
            cast(${projects.quotedTotal} as numeric) - coalesce((
              select sum(cast(${projectPayments.amount} as numeric))
              from ${projectPayments}
              where ${projectPayments.projectId} = ${projects.id}
            ), 0),
            0
          )), 0)`.as("ar_amount"),
        })
        .from(projects)
        .where(
          inArray(projects.status, [
            "planning",
            "in_progress",
            "on_hold",
            "installation_completed",
            "completed",
          ]),
        ),
    ]);

    const financeRow = financeRows[0];
    const arRow = arRows[0];

    return {
      todayCashIn: Math.round(Number(financeRow?.todayCashIn ?? 0)),
      todayCashOut: Math.round(Number(financeRow?.todayCashOut ?? 0)),
      monthIncome: Math.round(Number(financeRow?.monthIncome ?? 0)),
      monthExpense: Math.round(Number(financeRow?.monthExpense ?? 0)),
      arCount: Math.round(Number(arRow?.arCount ?? 0)),
      arAmount: Math.round(Number(arRow?.arAmount ?? 0)),
    };
  },
  ["dashboard:finance-quick-view"],
  { tags: [CACHE_TAGS.DASHBOARD_FINANCE], revalidate: 60 },
);

export const getFinanceQuickView = cache(async (): Promise<ActionResponse<FinanceQuickView>> => {
  try {
    await requireAuth();
    const cached = await getCachedFinanceQuickView();

    return successResponse({
      todayCashIn: cached.todayCashIn,
      todayCashOut: cached.todayCashOut,
      monthNetMovement: cached.monthIncome - cached.monthExpense,
      outstandingReceivableCount: cached.arCount,
      outstandingReceivableAmount: cached.arAmount,
    });
  } catch (error) {
    return handleActionError(error, "getFinanceQuickView", "Failed to fetch finance quick view");
  }
});
