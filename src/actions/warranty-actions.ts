"use server";

import { addDays, startOfToday } from "date-fns";
import type { InferSelectModel } from "drizzle-orm";
import { and, asc, eq, gt, gte, lt, lte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/validate";
import { db } from "@/lib/db";
import { customers, projects, warrantyAlerts } from "@/lib/db/schema";
import { WARRANTY_SOON_WINDOW_DAYS } from "@/lib/domain/policies";
import { notifyAllUsers } from "@/lib/notifications/broadcast";
import { type ActionResponse, successResponse } from "@/lib/utils/action-response";
import { handleActionError, handleNotFoundError } from "@/lib/utils/error";
import { uuidSchema } from "@/lib/validators/common";
import { warrantyListFilterSchema } from "@/lib/validators/warranty";

export type WarrantyAlertRow = InferSelectModel<typeof warrantyAlerts> & {
  projectNumber: string;
  customerName: string;
};

function tabWhere(
  tab: "overdue" | "due_soon" | "upcoming" | "resolved" | "all",
): ReturnType<typeof and> | ReturnType<typeof eq> | undefined {
  const today = startOfToday();
  const soonEnd = addDays(today, WARRANTY_SOON_WINDOW_DAYS);
  switch (tab) {
    case "resolved":
      return eq(warrantyAlerts.isResolved, true);
    case "overdue":
      return and(eq(warrantyAlerts.isResolved, false), lt(warrantyAlerts.dueDate, today));
    case "due_soon":
      return and(
        eq(warrantyAlerts.isResolved, false),
        gte(warrantyAlerts.dueDate, today),
        lte(warrantyAlerts.dueDate, soonEnd),
      );
    case "upcoming":
      return and(eq(warrantyAlerts.isResolved, false), gt(warrantyAlerts.dueDate, soonEnd));
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

    const [summary] = await db
      .select({
        overdue: sql<number>`cast(count(*) filter (where ${warrantyAlerts.isResolved} = false and ${warrantyAlerts.dueDate} < ${today}) as int)`,
        dueSoon: sql<number>`cast(count(*) filter (where ${warrantyAlerts.isResolved} = false and ${warrantyAlerts.dueDate} >= ${today} and ${warrantyAlerts.dueDate} <= ${soonEnd}) as int)`,
        upcoming: sql<number>`cast(count(*) filter (where ${warrantyAlerts.isResolved} = false and ${warrantyAlerts.dueDate} > ${soonEnd}) as int)`,
        active: sql<number>`cast(count(*) filter (where ${warrantyAlerts.isResolved} = false) as int)`,
      })
      .from(warrantyAlerts)
      .limit(1);

    return successResponse({
      overdue: summary?.overdue ?? 0,
      dueSoon: summary?.dueSoon ?? 0,
      upcoming: summary?.upcoming ?? 0,
      active: summary?.active ?? 0,
    });
  } catch (error) {
    return handleActionError(error, "getWarrantySummary", "Failed summary");
  }
}

export async function getWarrantyAlerts(raw: unknown): Promise<ActionResponse<WarrantyAlertRow[]>> {
  try {
    await requireAuth();
    const parsed = warrantyListFilterSchema.safeParse(raw);
    const filters = parsed.success ? parsed.data : warrantyListFilterSchema.parse({});
    const { tab, limit, offset } = filters;

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

    const query = (cond === undefined ? base : base.where(cond)).orderBy(
      asc(warrantyAlerts.dueDate),
    );
    const rows = tab === "all" ? await query.limit(limit).offset(offset) : await query;

    const items: WarrantyAlertRow[] = rows.map((r) => ({
      ...r.alert,
      projectNumber: r.projectNumber,
      customerName: r.customerName,
    }));

    return successResponse(items);
  } catch (error) {
    return handleActionError(error, "getWarrantyAlerts", "Failed alerts");
  }
}

export async function resolveWarrantyAlert(id: string): Promise<ActionResponse<boolean>> {
  try {
    await requireAuth();
    const validatedId = uuidSchema.parse(id);
    const alertRow = await db.query.warrantyAlerts.findFirst({
      where: eq(warrantyAlerts.id, validatedId),
      with: {
        project: {
          columns: { projectNumber: true },
        },
      },
    });

    if (!alertRow) return handleNotFoundError("Alert", validatedId);

    await db
      .update(warrantyAlerts)
      .set({ isResolved: true })
      .where(eq(warrantyAlerts.id, validatedId));

    await notifyAllUsers({
      title: "Alert resolved",
      message: `Warranty alert cleared for ${alertRow.project.projectNumber}`,
      type: "info",
      link: `/projects/${alertRow.projectId}`,
    });

    revalidatePath("/warranty");
    revalidatePath(`/projects/${alertRow.projectId}`);

    return successResponse(true);
  } catch (error) {
    return handleActionError(error, "resolveWarrantyAlert", "Failed resolve");
  }
}

export async function reopenWarrantyAlert(id: string): Promise<ActionResponse<boolean>> {
  try {
    await requireAuth();
    const validatedId = uuidSchema.parse(id);
    const row = await db.query.warrantyAlerts.findFirst({
      where: eq(warrantyAlerts.id, validatedId),
    });
    if (!row) return handleNotFoundError("Alert", validatedId);

    await db
      .update(warrantyAlerts)
      .set({ isResolved: false })
      .where(eq(warrantyAlerts.id, validatedId));

    revalidatePath("/warranty");
    revalidatePath(`/projects/${row.projectId}`);

    return successResponse(true);
  } catch (error) {
    return handleActionError(error, "reopenWarrantyAlert", "Failed reopen");
  }
}
