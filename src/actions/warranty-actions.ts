'use server';

import { db } from '@/lib/db';
import { warrantyAlerts, projects, customers } from '@/lib/db/schema';
import { eq, and, asc, sql, lt, lte, gt, gte } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/validate';
import { startOfToday, addDays } from 'date-fns';
import type { InferSelectModel } from 'drizzle-orm';
import { notifyAllUsers } from '@/lib/notifications/broadcast';
import { warrantyListFilterSchema } from '@/lib/validators/warranty';
import type { ActionResponse } from '@/lib/utils/action-response';
import { handleActionError, handleNotFoundError } from '@/lib/utils/error';
import { revalidatePath } from 'next/cache';
import { WARRANTY_SOON_WINDOW_DAYS } from '@/lib/domain/policies';

export type WarrantyAlertRow = InferSelectModel<typeof warrantyAlerts> & {
  projectNumber: string;
  customerName: string;
};

function tabWhere(
  tab: 'overdue' | 'due_soon' | 'upcoming' | 'resolved' | 'all',
) {
  const today = startOfToday();
  const soonEnd = addDays(today, WARRANTY_SOON_WINDOW_DAYS);
  switch (tab) {
    case 'resolved':
      return eq(warrantyAlerts.isResolved, true);
    case 'overdue':
      return and(
        eq(warrantyAlerts.isResolved, false),
        lt(warrantyAlerts.dueDate, today),
      );
    case 'due_soon':
      return and(
        eq(warrantyAlerts.isResolved, false),
        gte(warrantyAlerts.dueDate, today),
        lte(warrantyAlerts.dueDate, soonEnd),
      );
    case 'upcoming':
      return and(
        eq(warrantyAlerts.isResolved, false),
        gt(warrantyAlerts.dueDate, soonEnd),
      );
    case 'all':
    default:
      return undefined;
  }
}

export async function getWarrantySummary(): Promise<
  ActionResponse<{
    overdue: number;
    dueSoon: number;
    upcoming: number;
    active: number;
  }>
> {
  try {
    await requireAuth();
    const today = startOfToday();
    const soonEnd = addDays(today, WARRANTY_SOON_WINDOW_DAYS);

    const overdueRow = await db
      .select({ overdue: sql<number>`cast(count(*) as int)` })
      .from(warrantyAlerts)
      .where(
        and(
          eq(warrantyAlerts.isResolved, false),
          lt(warrantyAlerts.dueDate, today),
        ),
      );

    const dueSoonRow = await db
      .select({ dueSoon: sql<number>`cast(count(*) as int)` })
      .from(warrantyAlerts)
      .where(
        and(
          eq(warrantyAlerts.isResolved, false),
          gte(warrantyAlerts.dueDate, today),
          lte(warrantyAlerts.dueDate, soonEnd),
        ),
      );

    const upcomingRow = await db
      .select({ upcoming: sql<number>`cast(count(*) as int)` })
      .from(warrantyAlerts)
      .where(
        and(
          eq(warrantyAlerts.isResolved, false),
          gt(warrantyAlerts.dueDate, soonEnd),
        ),
      );

    const activeRow = await db
      .select({ active: sql<number>`cast(count(*) as int)` })
      .from(warrantyAlerts)
      .where(eq(warrantyAlerts.isResolved, false));

    return {
      success: true,
      data: {
        overdue: Number(overdueRow[0]?.overdue ?? 0),
        dueSoon: Number(dueSoonRow[0]?.dueSoon ?? 0),
        upcoming: Number(upcomingRow[0]?.upcoming ?? 0),
        active: Number(activeRow[0]?.active ?? 0),
      },
    };
  } catch (error) {
    return handleActionError(error, 'getWarrantySummary', 'Failed summary');
  }
}

export async function getWarrantyAlerts(
  raw: unknown,
): Promise<ActionResponse<WarrantyAlertRow[]>> {
  try {
    await requireAuth();
    const parsed = warrantyListFilterSchema.safeParse(raw);
    const tab = parsed.success ? parsed.data.tab : 'all';

    const cond = tabWhere(tab);

    const base = db
      .select({
        alert: warrantyAlerts,
        projectNumber: projects.projectNumber,
        customerName: customers.name,
      })
      .from(warrantyAlerts)
      .innerJoin(projects, eq(warrantyAlerts.projectId, projects.id))
      .innerJoin(customers, eq(projects.customerId, customers.id));

    const rows = await (cond === undefined ? base : base.where(cond)).orderBy(
      asc(warrantyAlerts.dueDate),
    );

    const items: WarrantyAlertRow[] = rows.map((r) => ({
      ...r.alert,
      projectNumber: r.projectNumber,
      customerName: r.customerName,
    }));

    return { success: true, data: items };
  } catch (error) {
    return handleActionError(error, 'getWarrantyAlerts', 'Failed alerts');
  }
}

export async function resolveWarrantyAlert(
  id: string,
): Promise<ActionResponse<boolean>> {
  try {
    await requireAuth();
    const alertRow = await db.query.warrantyAlerts.findFirst({
      where: eq(warrantyAlerts.id, id),
      with: {
        project: {
          columns: { projectNumber: true },
        },
      },
    });

    if (!alertRow) return handleNotFoundError('Alert', id);

    await db
      .update(warrantyAlerts)
      .set({ isResolved: true })
      .where(eq(warrantyAlerts.id, id));

    await notifyAllUsers({
      title: 'Alert resolved',
      message: `Warranty alert cleared for ${alertRow.project.projectNumber}`,
      type: 'info',
      link: `/projects/${alertRow.projectId}`,
    });

    revalidatePath('/warranty');
    revalidatePath(`/projects/${alertRow.projectId}`);

    return { success: true, data: true };
  } catch (error) {
    return handleActionError(error, 'resolveWarrantyAlert', 'Failed resolve');
  }
}

export async function reopenWarrantyAlert(
  id: string,
): Promise<ActionResponse<boolean>> {
  try {
    await requireAuth();
    const row = await db.query.warrantyAlerts.findFirst({
      where: eq(warrantyAlerts.id, id),
    });
    if (!row) return handleNotFoundError('Alert', id);

    await db
      .update(warrantyAlerts)
      .set({ isResolved: false })
      .where(eq(warrantyAlerts.id, id));

    revalidatePath('/warranty');
    revalidatePath(`/projects/${row.projectId}`);

    return { success: true, data: true };
  } catch (error) {
    return handleActionError(error, 'reopenWarrantyAlert', 'Failed reopen');
  }
}
