"use server";

import {
  addDays,
  addMonths,
  addYears,
  endOfDay,
  isBefore,
  startOfDay,
  startOfToday,
} from "date-fns";
import type { InferSelectModel } from "drizzle-orm";
import { and, asc, desc, eq, gte, ilike, inArray, lte, ne, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireAuth } from "@/lib/auth/validate";
import { db } from "@/lib/db";
import {
  type Customer,
  customers,
  type Project,
  type ProjectCost,
  type ProjectRemark,
  paymentMethods,
  projectCosts,
  projectRemarks,
  projects,
  type Quotation,
  quotations,
  type WarrantyAlert,
  warrantyAlerts,
} from "@/lib/db/schema";
import { BUDGET_VARIANCE_THRESHOLD } from "@/lib/domain/policies";
import {
  assertFinanceSsotDrift,
  createBalancedJournalEntry,
  mapCostTypeToExpenseAccount,
  mapPaymentMethodNameToAssetAccount,
} from "@/lib/finance/ledger";
import { notifyAdminUsers, notifyAllUsers } from "@/lib/notifications/broadcast";
import { type ActionResponse, successResponse } from "@/lib/utils/action-response";
import { handleActionError, handleNotFoundError, handleStateError } from "@/lib/utils/error";
import { extractProjectSequence, formatProjectNumber } from "@/lib/utils/project-number";
import { uuidSchema } from "@/lib/validators/common";
import {
  addProjectCostSchema,
  addProjectRemarkSchema,
  canTransitionProjectStatus,
  convertToProjectSchema,
  createWarrantyAlertSchema,
  isProjectStatus,
  projectListFilterSchema,
  updateProjectSchema,
} from "@/lib/validators/project";

export type ProjectListRow = InferSelectModel<typeof projects> & {
  customerName: string | null;
  quoteNumber: string | null;
  costTotal: number;
  /** Only set when listing completed installations */
  warrantySummary?: "ok" | "due_soon" | "overdue";
};

export type ProjectDetail = InferSelectModel<typeof projects> & {
  customer: Customer;
  quotation:
    | (Pick<Quotation, "id" | "quoteNumber" | "total"> & {
        notes: string | null;
      })
    | null;
  costs: (ProjectCost & {
    inventoryItem: { id: string; name: string } | null;
    addedByUser: { id: string; name: string } | null;
  })[];
  remarks: (ProjectRemark & {
    author: { id: string; name: string } | null;
  })[];
  warrantyAlerts: WarrantyAlert[];
  actualTotalComputed: number;
  budgetVariance: number;
};

async function nextProjectSequence(year: number): Promise<number> {
  const prefix = `PJ-${year}-`;
  const existing = await db
    .select({ projectNumber: projects.projectNumber })
    .from(projects)
    .where(ilike(projects.projectNumber, `${prefix}%`))
    .orderBy(desc(projects.createdAt))
    .limit(1);

  return extractProjectSequence(existing[0]?.projectNumber) + 1;
}

async function sumProjectCosts(projectId: string): Promise<number> {
  const [row] = await db
    .select({
      total: sql<string>`coalesce(sum(${projectCosts.amount}::numeric), 0)`.as("total"),
    })
    .from(projectCosts)
    .where(eq(projectCosts.projectId, projectId));
  return Math.round(Number(row?.total ?? 0));
}

async function persistActualTotal(projectId: string): Promise<number> {
  const total = await sumProjectCosts(projectId);
  await db
    .update(projects)
    .set({ actualTotal: String(total) })
    .where(eq(projects.id, projectId));
  return total;
}

function rollupWarranty(
  alerts: { isResolved: boolean; dueDate: Date }[],
): "ok" | "due_soon" | "overdue" {
  const today = startOfToday();
  const soonBoundaryEnd = addDays(today, 30);
  let overdue = false;
  let soon = false;
  for (const a of alerts) {
    if (a.isResolved) continue;
    const dueDay = startOfDay(new Date(a.dueDate));
    if (isBefore(dueDay, today)) overdue = true;
    else if (dueDay.getTime() <= soonBoundaryEnd.getTime()) soon = true;
  }
  if (overdue) return "overdue";
  if (soon) return "due_soon";
  return "ok";
}

async function maybeNotifyBudgetOverrun(
  projectId: string,
  quotedTotal: number,
  previousSpend: number,
  actualSpend: number,
): Promise<void> {
  if (quotedTotal <= 0) return;
  const threshold = Math.round(quotedTotal * BUDGET_VARIANCE_THRESHOLD);
  // Only notify the first time actual spend crosses budget threshold.
  if (actualSpend <= threshold) return;
  if (previousSpend > threshold) return;

  await notifyAdminUsers({
    title: "Project budget alert",
    message: `Spend on project has exceeded quoted total by more than 10% (actual ${actualSpend.toLocaleString("en-MM")} MMK).`,
    type: "warning",
    link: `/projects/${projectId}`,
  });
}

export async function convertQuotationToProject(raw: unknown): Promise<ActionResponse<Project>> {
  try {
    await requireAuth();
    const data = convertToProjectSchema.parse(raw);

    const year = new Date().getFullYear();
    let retries = 3;

    while (retries > 0) {
      try {
        return await db.transaction(async (tx): Promise<ActionResponse<Project>> => {
          // Lock the quotation row to prevent concurrent conversions
          const quotation = await tx.query.quotations.findFirst({
            where: eq(quotations.id, data.quotationId),
            with: { customer: true, project: { columns: { id: true } } },
          });

          if (!quotation) {
            return handleNotFoundError("Quotation", data.quotationId);
          }
          if (quotation.status !== "accepted") {
            return handleStateError("Only accepted quotations can be converted.");
          }

          if ((quotation as unknown as { project?: unknown }).project != null) {
            return handleStateError("This quotation is already linked to a project.");
          }

          const customer = quotation.customer;
          const defaultSite = [customer.address, customer.city].filter(Boolean).join(", ").trim();

          const siteAddress = data.siteAddress?.trim() || defaultSite || "—";

          const systemKwp =
            data.systemSizeKwp !== null && data.systemSizeKwp !== undefined
              ? String(data.systemSizeKwp)
              : "0";

          // Get next project sequence within the transaction
          const seq = await nextProjectSequence(year);
          const projectNumber = formatProjectNumber(seq, year);

          const [created] = await tx
            .insert(projects)
            .values({
              projectNumber,
              quotationId: quotation.id,
              customerId: quotation.customerId,
              status: "planning",
              siteAddress,
              systemSizeKwp: systemKwp,
              quotedTotal: quotation.total,
              actualTotal: "0",
              startDate: data.startDate ?? null,
              targetCompletion: data.targetCompletion ?? null,
              notes: data.notes ?? null,
            })
            .returning();

          if (!created) {
            return handleStateError("Failed to create project");
          }

          revalidatePath("/projects");
          revalidatePath(`/quotations/${quotation.id}`);
          revalidatePath("/quotations");

          return successResponse(created);
        });
      } catch (error: unknown) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "23505" &&
          retries > 1
        ) {
          // 23505 is unique_violation - could be project number or quotation_id conflict
          retries--;
          continue;
        }
        throw error;
      }
    }

    return handleStateError("Failed to generate unique project number after retries.");
  } catch (error) {
    return handleActionError(error, "convertQuotationToProject", "Failed to convert quotation");
  }
}

export async function getProjects(
  rawFilters: unknown = {},
): Promise<ActionResponse<{ items: ProjectListRow[]; total: number }>> {
  try {
    await requireAuth();

    const filters = projectListFilterSchema.parse(rawFilters);
    const { scope, status, search, year, completedFrom, completedTo, limit, offset } = filters;

    const scopeCond =
      scope === "active"
        ? inArray(projects.status, ["planning", "in_progress", "on_hold"])
        : eq(projects.status, "completed");

    const statusCond = status ? eq(projects.status, status) : undefined;

    const yearCond =
      year && scope === "completed"
        ? sql`extract(year from ${projects.actualCompletion}) = ${year}`
        : year
          ? sql`extract(year from ${projects.createdAt}) = ${year}`
          : undefined;

    const completedFromCond =
      completedFrom && scope === "completed"
        ? gte(projects.actualCompletion, startOfDay(completedFrom))
        : undefined;
    const completedToCond =
      completedTo && scope === "completed"
        ? lte(projects.actualCompletion, endOfDay(completedTo))
        : undefined;

    const searchCond = search?.trim()
      ? or(
          ilike(projects.projectNumber, `%${search}%`),
          sql`exists (
              select 1 from ${customers} c
              where c.id = ${projects.customerId}
              and c.name ilike ${`%${search.trim()}%`}
            )`,
        )
      : undefined;

    const whereClause = and(
      scopeCond,
      statusCond,
      yearCond,
      completedFromCond,
      completedToCond,
      searchCond,
    );

    const [rows, countRows] = await Promise.all([
      db
        .select({
          project: projects,
          customerName: customers.name,
          quoteNumber: quotations.quoteNumber,
          costTotal: sql<number>`coalesce(sum(${projectCosts.amount}::numeric), 0)`.as(
            "cost_total",
          ),
        })
        .from(projects)
        .innerJoin(customers, eq(projects.customerId, customers.id))
        .leftJoin(quotations, eq(projects.quotationId, quotations.id))
        .leftJoin(projectCosts, eq(projectCosts.projectId, projects.id))
        .where(whereClause)
        .groupBy(projects.id, customers.name, quotations.quoteNumber)
        .orderBy(scope === "completed" ? desc(projects.actualCompletion) : desc(projects.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(projects)
        .innerJoin(customers, eq(projects.customerId, customers.id))
        .leftJoin(quotations, eq(projects.quotationId, quotations.id))
        .where(whereClause),
    ]);

    const totalCount = countRows[0]?.count ?? 0;

    const items: ProjectListRow[] = rows.map((r) => ({
      ...r.project,
      customerName: r.customerName,
      quoteNumber: r.quoteNumber,
      costTotal: Math.round(r.costTotal),
    }));

    if (scope === "completed") {
      const ids = rows.map((r) => r.project.id);
      if (ids.length > 0) {
        const allAlerts = await db.query.warrantyAlerts.findMany({
          where: inArray(warrantyAlerts.projectId, ids),
        });

        const byProject = new Map<string, WarrantyAlert[]>();
        for (const a of allAlerts) {
          const bucket = byProject.get(a.projectId);
          if (bucket) bucket.push(a);
          else byProject.set(a.projectId, [a]);
        }

        for (const row of items) {
          row.warrantySummary = rollupWarranty(
            byProject.get(row.id)?.map(({ dueDate, isResolved }) => ({
              dueDate: new Date(dueDate),
              isResolved,
            })) ?? [],
          );
        }
      }
    }

    return successResponse({ items, total: totalCount });
  } catch (error) {
    return handleActionError(error, "getProjects", "Failed to fetch projects");
  }
}

export async function getProject(id: string): Promise<ActionResponse<ProjectDetail>> {
  try {
    await requireAuth();
    const validatedId = uuidSchema.parse(id);

    const row = await db.query.projects.findFirst({
      where: eq(projects.id, validatedId),
      with: {
        customer: true,
        quotation: {
          columns: {
            id: true,
            quoteNumber: true,
            total: true,
            notes: true,
          },
        },
        costs: {
          orderBy: [desc(projectCosts.incurredDate)],
          with: {
            inventoryItem: {
              columns: { id: true, name: true },
            },
            addedBy: {
              columns: { id: true, name: true },
            },
          },
        },
        remarks: {
          orderBy: [desc(projectRemarks.createdAt)],
          with: {
            author: { columns: { id: true, name: true } },
          },
        },
        warrantyAlerts: {
          orderBy: [asc(warrantyAlerts.dueDate)],
        },
      },
    });

    if (!row) {
      return handleNotFoundError("Project", validatedId);
    }

    const actualTotalComputed = Math.round(
      row.costs.reduce((sum, cost) => sum + Math.round(Number(cost.amount)), 0),
    );
    const quoted = Math.round(Number(row.quotedTotal));
    const budgetVariance = actualTotalComputed - quoted;

    const costs: ProjectDetail["costs"] = row.costs.map((c) => ({
      ...c,
      inventoryItem: c.inventoryItem,
      addedByUser: c.addedBy,
    }));

    const remarks: ProjectDetail["remarks"] = row.remarks.map((rem) => ({
      ...rem,
      author: rem.author,
    }));

    return successResponse({
      ...row,
      quotation: row.quotation,
      costs,
      remarks,
      warrantyAlerts: row.warrantyAlerts,
      actualTotalComputed,
      budgetVariance,
    });
  } catch (error) {
    return handleActionError(error, "getProject", "Failed to fetch project");
  }
}

/**
 * Mark a project as completed and run completion side-effects (refresh
 * actual_total, seed warranty alerts, fire notification). All DB writes
 * run inside one transaction so we can't end up with `status='completed'`
 * but missing warranty alerts (or vice versa) if a later step throws.
 *
 * Notifications are deliberately fired AFTER the tx commits so we never
 * notify users about a state that was rolled back.
 */
async function applyProjectCompletion(
  projectRow: InferSelectModel<typeof projects>,
): Promise<void> {
  const didComplete = await db.transaction(async (tx) => {
    // Idempotent: skip if already completed.
    const updated = await tx
      .update(projects)
      .set({
        status: "completed",
        actualCompletion: new Date(),
      })
      .where(and(eq(projects.id, projectRow.id), ne(projects.status, "completed")))
      .returning({ id: projects.id });

    if (updated.length === 0) return false;

    // Refresh actualTotal from costs ledger.
    const [sumRow] = await tx
      .select({
        total: sql<string>`coalesce(sum(${projectCosts.amount}::numeric), 0)`.as("total"),
      })
      .from(projectCosts)
      .where(eq(projectCosts.projectId, projectRow.id));
    const total = Math.round(Number(sumRow?.total ?? 0));
    await tx
      .update(projects)
      .set({ actualTotal: String(total) })
      .where(eq(projects.id, projectRow.id));

    // Seed default warranty alerts.
    const now = new Date();
    await tx.insert(warrantyAlerts).values([
      {
        projectId: projectRow.id,
        alertType: "warranty_expiry",
        description: "Panel Warranty Check",
        dueDate: addYears(now, 1),
        isResolved: false,
      },
      {
        projectId: projectRow.id,
        alertType: "warranty_expiry",
        description: "Inverter Warranty Check",
        dueDate: addYears(now, 1),
        isResolved: false,
      },
      {
        projectId: projectRow.id,
        alertType: "maintenance_due",
        description: "System Maintenance",
        dueDate: addMonths(now, 6),
        isResolved: false,
      },
    ]);

    return true;
  });

  if (didComplete) {
    await notifyAllUsers({
      title: "Project completed",
      message: `Project ${projectRow.projectNumber} completed!`,
      type: "info",
      link: `/projects/${projectRow.id}`,
    });
  }
}

export async function updateProject(raw: unknown): Promise<ActionResponse<Project>> {
  try {
    const auth = await requireAuth();
    const data = updateProjectSchema.parse(raw);

    const existing = await db.query.projects.findFirst({
      where: eq(projects.id, data.id),
    });
    if (!existing) return handleNotFoundError("Project", data.id);

    if (data.status !== undefined && data.status !== existing.status) {
      if (auth.role !== "admin") {
        return handleStateError("Only admins can change project status here.");
      }
      if (!isProjectStatus(existing.status)) {
        return handleStateError(`Invalid current status: ${existing.status as string}`);
      }
      if (!canTransitionProjectStatus(existing.status, data.status)) {
        return handleStateError(`Invalid status transition to ${data.status}`);
      }

      if (data.status === "completed") {
        await applyProjectCompletion(existing);
      } else {
        const patch: Partial<typeof projects.$inferInsert> = {
          status: data.status,
        };
        if (
          existing.status === "planning" &&
          data.status === "in_progress" &&
          !existing.startDate
        ) {
          patch.startDate = new Date();
        }
        if (data.siteAddress !== undefined) {
          patch.siteAddress = data.siteAddress?.trim() || existing.siteAddress;
        }
        if (data.systemSizeKwp !== undefined) {
          patch.systemSizeKwp = String(data.systemSizeKwp);
        }
        if (data.targetCompletion !== undefined) {
          patch.targetCompletion = data.targetCompletion;
        }
        if (data.notes !== undefined) patch.notes = data.notes;
        await db.update(projects).set(patch).where(eq(projects.id, data.id));

        await notifyAllUsers({
          title: "Project status changed",
          message: `Project ${existing.projectNumber} moved from ${existing.status.replace("_", " ")} to ${data.status.replace("_", " ")}.`,
          type: "info",
          link: `/projects/${existing.id}`,
        });
      }
    } else {
      const patch: Partial<typeof projects.$inferInsert> = {};
      if (data.siteAddress !== undefined) {
        patch.siteAddress = data.siteAddress?.trim() || existing.siteAddress;
      }
      if (data.systemSizeKwp !== undefined) {
        patch.systemSizeKwp = String(data.systemSizeKwp);
      }
      if (data.targetCompletion !== undefined) {
        patch.targetCompletion = data.targetCompletion;
      }
      if (data.notes !== undefined) patch.notes = data.notes;
      if (Object.keys(patch).length > 0) {
        await db.update(projects).set(patch).where(eq(projects.id, data.id));
      }
    }

    const updated = await db.query.projects.findFirst({
      where: eq(projects.id, data.id),
    });
    if (!updated) return handleNotFoundError("Project", data.id);

    revalidatePath("/projects");
    revalidatePath(`/projects/${data.id}`);
    revalidatePath("/projects/completed");
    revalidatePath("/warranty");

    return successResponse(updated);
  } catch (error) {
    return handleActionError(error, "updateProject", "Failed to update project");
  }
}

export async function markProjectCompleted(id: string): Promise<ActionResponse<Project>> {
  try {
    await requireAdmin();
    const validatedId = uuidSchema.parse(id);
    const existing = await db.query.projects.findFirst({
      where: eq(projects.id, validatedId),
    });
    if (!existing) return handleNotFoundError("Project", validatedId);

    if (existing.status === "completed") {
      return handleStateError("Project is already completed.");
    }

    if (!isProjectStatus(existing.status)) {
      return handleStateError(`Invalid current status: ${existing.status as string}`);
    }

    if (!canTransitionProjectStatus(existing.status, "completed")) {
      return handleStateError("Cannot mark this project completed from its current status.");
    }

    await applyProjectCompletion(existing);

    const updated = await db.query.projects.findFirst({
      where: eq(projects.id, validatedId),
    });
    if (!updated) return handleNotFoundError("Project", validatedId);

    revalidatePath("/projects");
    revalidatePath(`/projects/${validatedId}`);
    revalidatePath("/projects/completed");
    revalidatePath("/warranty");

    return successResponse(updated);
  } catch (error) {
    return handleActionError(error, "markProjectCompleted", "Failed to complete project");
  }
}

export async function addProjectCost(raw: unknown): Promise<ActionResponse<ProjectCost[]>> {
  try {
    const auth = await requireAuth();
    assertFinanceSsotDrift();
    const data = addProjectCostSchema.parse(raw);

    const projectRow = await db.query.projects.findFirst({
      where: eq(projects.id, data.projectId),
    });
    if (!projectRow) return handleNotFoundError("Project", data.projectId);
    if (projectRow.status === "completed" || projectRow.status === "cancelled") {
      return handleStateError("Cannot add costs to a completed or cancelled project.");
    }

    await db.transaction(async (tx) => {
      const [createdCost] = await tx
        .insert(projectCosts)
        .values({
          projectId: data.projectId,
          itemId: data.itemId ?? null,
          description: data.description,
          amount: String(Math.round(data.amount)),
          costType: data.costType,
          incurredDate: data.incurredDate,
          addedBy: auth.userId,
        })
        .returning({ id: projectCosts.id });

      if (!createdCost) {
        throw new Error("cost_insert_failed");
      }

      const method = await tx.query.paymentMethods.findFirst({
        where: eq(paymentMethods.id, data.paymentMethodId),
      });
      if (!method) {
        throw new Error("payment_method_not_found");
      }

      const assetAccount = mapPaymentMethodNameToAssetAccount(method.name);
      if (!assetAccount) {
        throw new Error(`unsupported_payment_method:${method.name}`);
      }

      const expenseAccount = mapCostTypeToExpenseAccount(data.costType);
      const amountRounded = Math.round(data.amount);
      await createBalancedJournalEntry({
        tx,
        entryDate: data.incurredDate,
        memo: data.description,
        sourceType: "project_expense",
        sourceId: createdCost.id,
        projectId: data.projectId,
        createdBy: auth.userId,
        lines: [
          {
            accountCode: expenseAccount,
            debit: amountRounded,
            credit: 0,
          },
          {
            accountCode: assetAccount,
            debit: 0,
            credit: amountRounded,
          },
        ],
      });
    });

    const actualSpend = await persistActualTotal(data.projectId);
    const previousSpend = actualSpend - Math.round(data.amount);
    await maybeNotifyBudgetOverrun(
      data.projectId,
      Math.round(Number(projectRow.quotedTotal)),
      previousSpend,
      actualSpend,
    );

    const costs = await db.query.projectCosts.findMany({
      where: eq(projectCosts.projectId, data.projectId),
      orderBy: [desc(projectCosts.incurredDate)],
    });

    revalidatePath(`/projects/${data.projectId}`);
    revalidatePath("/projects");

    return successResponse(costs);
  } catch (error) {
    return handleActionError(error, "addProjectCost", "Failed to add cost");
  }
}

export async function deleteProjectCost(
  costId: string,
): Promise<ActionResponse<{ projectId: string }>> {
  try {
    await requireAuth();
    const validatedCostId = uuidSchema.parse(costId);
    const cost = await db.query.projectCosts.findFirst({
      where: eq(projectCosts.id, validatedCostId),
    });
    if (!cost) return handleNotFoundError("Cost record", validatedCostId);

    await db.delete(projectCosts).where(eq(projectCosts.id, validatedCostId));
    await persistActualTotal(cost.projectId);

    revalidatePath(`/projects/${cost.projectId}`);
    revalidatePath("/projects");

    return successResponse({ projectId: cost.projectId });
  } catch (error) {
    return handleActionError(error, "deleteProjectCost", "Failed to delete cost");
  }
}

export async function addProjectRemark(raw: unknown): Promise<ActionResponse<ProjectRemark[]>> {
  try {
    const auth = await requireAuth();
    const data = addProjectRemarkSchema.parse(raw);

    const projectRow = await db.query.projects.findFirst({
      where: eq(projects.id, data.projectId),
    });
    if (!projectRow) return handleNotFoundError("Project", data.projectId);

    await db.insert(projectRemarks).values({
      projectId: data.projectId,
      authorId: auth.userId,
      content: data.content.trim(),
      remarkType: data.remarkType,
    });

    const remarks = await db.query.projectRemarks.findMany({
      where: eq(projectRemarks.projectId, data.projectId),
      orderBy: [desc(projectRemarks.createdAt)],
    });

    revalidatePath(`/projects/${data.projectId}`);

    return successResponse(remarks);
  } catch (error) {
    return handleActionError(error, "addProjectRemark", "Failed to add remark");
  }
}

export async function deleteProjectRemark(
  remarkId: string,
): Promise<ActionResponse<{ projectId: string }>> {
  try {
    const auth = await requireAuth();
    const validatedRemarkId = uuidSchema.parse(remarkId);

    const remark = await db.query.projectRemarks.findFirst({
      where: eq(projectRemarks.id, validatedRemarkId),
    });
    if (!remark) return handleNotFoundError("Remark", validatedRemarkId);

    const isAuthor = remark.authorId === auth.userId;
    const isAdmin = auth.role === "admin";
    if (!isAuthor && !isAdmin) {
      return handleStateError("You can only delete your own remarks.");
    }

    await db.delete(projectRemarks).where(eq(projectRemarks.id, validatedRemarkId));

    revalidatePath(`/projects/${remark.projectId}`);

    return successResponse({ projectId: remark.projectId });
  } catch (error) {
    return handleActionError(error, "deleteProjectRemark", "Failed to delete remark");
  }
}

export async function createWarrantyAlertForProject(
  raw: unknown,
): Promise<ActionResponse<WarrantyAlert>> {
  try {
    await requireAuth();
    const data = createWarrantyAlertSchema.parse(raw);

    const projectRow = await db.query.projects.findFirst({
      where: eq(projects.id, data.projectId),
    });
    if (!projectRow) return handleNotFoundError("Project", data.projectId);

    const [alert] = await db
      .insert(warrantyAlerts)
      .values({
        projectId: data.projectId,
        alertType: data.alertType,
        description: data.description.trim(),
        dueDate: data.dueDate,
        isResolved: false,
      })
      .returning();

    if (!alert) return handleStateError("Failed to create alert");

    await notifyAllUsers({
      title: "New warranty alert",
      message: `${projectRow.projectNumber}: ${data.description}`,
      type: "action",
      link: `/projects/${data.projectId}`,
    });

    revalidatePath(`/projects/${data.projectId}`);
    revalidatePath("/warranty");

    return successResponse(alert);
  } catch (error) {
    return handleActionError(
      error,
      "createWarrantyAlertForProject",
      "Failed to create warranty alert",
    );
  }
}
