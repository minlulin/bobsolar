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
import { revalidatePath, revalidateTag } from "next/cache";
import { requireAdmin, requireAuth, requireFinanceAccess } from "@/lib/auth/validate";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import {
  customers,
  inventoryItems,
  journalEntries,
  journalLines,
  ledgerAccounts,
  type Project,
  type ProjectCost,
  type ProjectRemark,
  paymentMethods,
  projectCosts,
  projectPayments,
  projectRemarks,
  projects,
  quotationItems,
  quotations,
  type WarrantyAlert,
  warrantyAlerts,
} from "@/lib/db/schema";
import { BUDGET_VARIANCE_THRESHOLD } from "@/lib/domain/policies";
import {
  assertFinanceSsotDrift,
  assertJournalEntryNotReversed,
  createBalancedJournalEntry,
  type DbTransaction,
  mapCostTypeToExpenseAccount,
  mapPaymentMethodNameToAssetAccount,
  reverseJournalEntry,
} from "@/lib/finance/ledger";
import { notifyAdminUsers, notifyAllUsers } from "@/lib/notifications/broadcast";
import { type ActionResponse, successResponse } from "@/lib/utils/action-response";
import { AdvisoryLock } from "@/lib/utils/advisory-lock";
import { handleActionError, handleNotFoundError, handleStateError } from "@/lib/utils/error";
import { extractProjectSequence, formatProjectNumber } from "@/lib/utils/project-number";
import { toDbDecimal, uuidSchema } from "@/lib/validators/common";
import {
  addProjectCostSchema,
  addProjectRemarkSchema,
  canTransitionProjectStatus,
  consumeProjectInventorySchema,
  convertToProjectSchema,
  createWarrantyAlertSchema,
  isProjectStatus,
  projectListFilterSchema,
  updateProjectSchema,
} from "@/lib/validators/project";

function _projectListQuery() {
  return db
    .select({
      project: projects,
      customerName: customers.name,
      quoteNumber: quotations.quoteNumber,
      costTotal:
        sql<number>`coalesce(sum(case when ${projectCosts.isReversed} = false then ${projectCosts.amount}::numeric else 0 end), 0)`.as(
          "cost_total",
        ),
    })
    .from(projects)
    .innerJoin(customers, eq(projects.customerId, customers.id))
    .leftJoin(quotations, eq(projects.quotationId, quotations.id))
    .leftJoin(projectCosts, eq(projectCosts.projectId, projects.id));
}

export type ProjectListRow = Awaited<ReturnType<typeof _projectListQuery>>[number]["project"] & {
  customerName: string | null;
  quoteNumber: string | null;
  costTotal: number;
  /** Only set when listing completed installations */
  warrantySummary?: "ok" | "due_soon" | "overdue";
};

function _projectDetailQuery() {
  return db.query.projects.findFirst({
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
      invoices: true,
    },
  });
}

type BaseProjectDetail = NonNullable<Awaited<ReturnType<typeof _projectDetailQuery>>>;

export type ProjectDetail = BaseProjectDetail & {
  actualTotalComputed: number;
  budgetVariance: number;
  hasMissingInventoryConsumption: boolean;
  profitability: {
    quotedRevenue: number;
    invoicedRevenue: number;
    receivedPayment: number;
    outstandingReceivable: number;
    cogs: number;
    inventoryConsumedCost: number;
    additionalCosts: number;
    grossProfit: number;
    netProfit: number;
    grossMarginPercent: number;
    netMarginPercent: number;
  };
};

async function nextProjectSequence(year: number, tx: DbTransaction): Promise<number> {
  const prefix = `PJ-${year}-`;
  const existing = await tx
    .select({ projectNumber: projects.projectNumber })
    .from(projects)
    .where(ilike(projects.projectNumber, `${prefix}%`))
    .orderBy(desc(projects.projectNumber))
    .limit(1);

  return extractProjectSequence(existing[0]?.projectNumber) + 1;
}

async function sumProjectCosts(projectId: string, tx?: DbTransaction): Promise<number> {
  const client = tx || db;
  const [row] = await client
    .select({
      total: sql<string>`coalesce(sum(${projectCosts.amount}::numeric), 0)`.as("total"),
    })
    .from(projectCosts)
    .where(and(eq(projectCosts.projectId, projectId), eq(projectCosts.isReversed, false)));
  return Math.round(Number(row?.total ?? 0));
}

async function persistActualTotal(projectId: string, tx?: DbTransaction): Promise<number> {
  const total = await sumProjectCosts(projectId, tx);
  const client = tx || db;
  await client
    .update(projects)
    .set({ actualTotal: toDbDecimal(total), updatedAt: new Date() })
    .where(eq(projects.id, projectId));
  return total;
}

type InventoryConsumptionPost = {
  tx: DbTransaction;
  projectId: string;
  inventoryItemId: string;
  quantity: number;
  description: string;
  incurredDate: Date;
  createdBy: string;
  totalCostOverride?: number;
};

async function postInventoryConsumptionToProject({
  tx,
  projectId,
  inventoryItemId,
  quantity,
  description,
  incurredDate,
  createdBy,
  totalCostOverride,
}: InventoryConsumptionPost): Promise<{ actualSpend: number; consumedAmount: number }> {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error("invalid_inventory_quantity");
  }

  const [item] = await tx
    .select({
      id: inventoryItems.id,
      name: inventoryItems.name,
      costPrice: inventoryItems.costPrice,
      stockQty: inventoryItems.stockQty,
      isActive: inventoryItems.isActive,
    })
    .from(inventoryItems)
    .where(eq(inventoryItems.id, inventoryItemId))
    .for("update");
  if (!item) {
    throw new Error("inventory_not_found");
  }
  if (!item.isActive) {
    throw new Error("inventory_inactive");
  }
  if (item.stockQty < quantity) {
    throw new Error("insufficient_stock");
  }

  await tx
    .update(inventoryItems)
    .set({
      stockQty: item.stockQty - quantity,
      updatedAt: new Date(),
    })
    .where(eq(inventoryItems.id, item.id));

  const amountRounded =
    totalCostOverride !== undefined
      ? Math.round(totalCostOverride)
      : Math.round(Number(item.costPrice) * quantity);
  if (amountRounded < 1) {
    throw new Error("inventory_cost_required");
  }

  const [createdCost] = await tx
    .insert(projectCosts)
    .values({
      projectId,
      itemId: item.id,
      paymentMethodId: null,
      description,
      amount: String(amountRounded),
      quantity,
      costType: "material",
      incurredDate,
      addedBy: createdBy,
    })
    .returning({ id: projectCosts.id });

  if (!createdCost) {
    throw new Error("cost_insert_failed");
  }

  await createBalancedJournalEntry({
    tx,
    entryDate: incurredDate,
    memo: `${description} (consume ${quantity} x ${item.name})`,
    sourceType: "inventory_consumption",
    sourceId: createdCost.id,
    projectId,
    createdBy,
    lines: [
      {
        accountCode: "cost_of_goods_sold",
        debit: amountRounded,
        credit: 0,
      },
      {
        accountCode: "raw_materials",
        debit: 0,
        credit: amountRounded,
      },
    ],
  });

  const actualSpend = await persistActualTotal(projectId, tx);
  return { actualSpend, consumedAmount: amountRounded };
}

async function getProjectReceivedPayment(projectId: string): Promise<number> {
  const [row] = await db
    .select({
      total: sql<string>`coalesce(sum(${projectPayments.amount}::numeric), 0)`.as("total"),
    })
    .from(projectPayments)
    .where(eq(projectPayments.projectId, projectId));
  return Math.round(Number(row?.total ?? 0));
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
            with: { customer: true },
          });

          if (!quotation) {
            return handleNotFoundError("Quotation", data.quotationId);
          }
          if (quotation.status !== "accepted") {
            return handleStateError("Only accepted quotations can be converted.");
          }

          const existingProject = await tx.query.projects.findFirst({
            where: eq(projects.quotationId, data.quotationId),
          });
          if (existingProject) {
            return handleStateError("This quotation is already linked to a project.");
          }

          const customer = quotation.customer;
          const defaultSite = [customer.address, customer.city].filter(Boolean).join(", ").trim();

          const siteAddress = data.siteAddress?.trim() || defaultSite || "—";

          const systemKwp =
            data.systemSizeKwp !== undefined ? toDbDecimal(data.systemSizeKwp) : "0";

          const lockKey = BigInt(0x50_52_4f_4a); // 'PROJ'
          const lock = new AdvisoryLock(tx, lockKey);
          const acquired = await lock.acquire();
          if (!acquired) {
            return handleStateError("Too many concurrent requests – please try again");
          }

          try {
            // Get next project sequence within the transaction
            const seq = await nextProjectSequence(year, tx);
            const projectNumber = formatProjectNumber(seq, year);

            // Calculate estimated COGS from quotation items cost snapshots
            const quoteItems = await tx
              .select({
                itemId: quotationItems.itemId,
                description: quotationItems.description,
                quantity: quotationItems.quantity,
                costPrice: quotationItems.costPrice,
                costTotal: quotationItems.costTotal,
              })
              .from(quotationItems)
              .where(eq(quotationItems.quotationId, quotation.id));

            const estimatedCogs = quoteItems.reduce(
              (sum, item) => sum + Math.round(Number(item.costTotal)),
              0,
            );

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
                estimatedCogs: toDbDecimal(estimatedCogs),
                actualTotal: "0",
                startDate: data.startDate ?? null,
                targetCompletion: data.targetCompletion ?? null,
                notes: data.notes ?? null,
              })
              .returning();

            if (!created) {
              return handleStateError("Failed to create project");
            }

            revalidateTag(CACHE_TAGS.DASHBOARD_STATS, "max");
            revalidatePath("/projects");
            revalidatePath(`/quotations/${quotation.id}`);
            revalidatePath("/quotations");

            return successResponse(created);
          } finally {
            await lock.release();
          }
        });
      } catch (error: unknown) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code: unknown }).code === "23505" &&
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
    if (error instanceof Error) {
      if (error.message === "inventory_not_found") {
        return handleStateError("Quoted inventory item not found.");
      }
      if (error.message === "inventory_inactive") {
        return handleStateError("Quoted inventory item is inactive.");
      }
      if (error.message === "insufficient_stock") {
        return handleStateError("Insufficient stock for quoted inventory item.");
      }
      if (error.message === "invalid_inventory_quantity") {
        return handleStateError("Quoted inventory quantity must be a whole number.");
      }
      if (error.message === "inventory_cost_required") {
        return handleStateError("Quoted inventory item must have a positive cost.");
      }
    }
    return handleActionError(error, "convertQuotationToProject", "Failed to convert quotation");
  }
}

export async function getProjects(
  rawFilters: unknown = {},
): Promise<ActionResponse<{ items: ProjectListRow[]; total: number }>> {
  try {
    await requireAuth();

    const filters = projectListFilterSchema.parse(rawFilters);
    const { scope, status, search, year, completedFrom, completedTo, page, limit } = filters;
    const offset = (page - 1) * limit;

    const scopeCond =
      scope === "active"
        ? inArray(projects.status, ["planning", "in_progress", "on_hold", "installation_completed"])
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
      ? (() => {
          const escaped = search.trim().replace(/%/g, "\\%").replace(/_/g, "\\_");
          return or(
            ilike(projects.projectNumber, `%${escaped}%`),
            sql`exists (
              select 1 from ${customers} c
              where c.id = ${projects.customerId}
              and c.name ilike ${`%${escaped}%`}
            )`,
          );
        })()
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
          costTotal:
            sql<number>`coalesce(sum(case when ${projectCosts.isReversed} = false then ${projectCosts.amount}::numeric else 0 end), 0)`.as(
              "cost_total",
            ),
        })
        .from(projects)
        .innerJoin(customers, eq(projects.customerId, customers.id))
        .leftJoin(quotations, eq(projects.quotationId, quotations.id))
        .leftJoin(projectCosts, eq(projectCosts.projectId, projects.id))
        .where(whereClause)
        .groupBy(projects.id, customers.name, quotations.quoteNumber)
        .orderBy(
          scope === "completed" ? desc(projects.actualCompletion) : desc(projects.createdAt),
          desc(projects.id),
        )
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
          with: { items: { with: { inventoryItem: true } } },
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
        invoices: true,
      },
    });

    if (!row) {
      return handleNotFoundError("Project", validatedId);
    }

    const activeCosts = row.costs.filter((c) => !c.isReversed);
    const actualTotalComputed = Math.round(
      activeCosts.reduce((sum, cost) => sum + Math.round(Number(cost.amount)), 0),
    );
    const quoted = Math.round(Number(row.quotedTotal));
    const budgetVariance = actualTotalComputed - quoted;
    const receivedPayment = await getProjectReceivedPayment(validatedId);

    const validInvoices = row.invoices.filter((i) => i.status !== "voided" && i.status !== "draft");
    const invoicedRevenue = Math.round(
      validInvoices.reduce((sum, inv) => sum + Math.round(Number(inv.total)), 0),
    );
    const outstandingReceivable = Math.round(
      validInvoices.reduce((sum, inv) => sum + Math.round(Number(inv.balanceDue)), 0),
    );

    const inventoryConsumedCost = Math.round(
      activeCosts
        .filter((cost) => cost.itemId !== null)
        .reduce((sum, cost) => sum + Math.round(Number(cost.amount)), 0),
    );
    const cogs = inventoryConsumedCost;
    const additionalCosts = actualTotalComputed - inventoryConsumedCost;
    const grossProfit = invoicedRevenue - cogs;
    const netProfit = grossProfit - additionalCosts;
    const grossMarginPercent =
      invoicedRevenue > 0 ? Math.round((grossProfit / invoicedRevenue) * 100) : 0;
    const netMarginPercent =
      invoicedRevenue > 0 ? Math.round((netProfit / invoicedRevenue) * 100) : 0;

    const hasQuotedStock =
      row.quotation?.items.some(
        (item) =>
          item.inventoryItem &&
          ["panel", "inverter", "battery", "mounting"].includes(item.inventoryItem.category),
      ) ?? false;
    const hasMissingInventoryConsumption = hasQuotedStock && inventoryConsumedCost === 0;

    return successResponse({
      ...row,
      actualTotalComputed,
      budgetVariance,
      hasMissingInventoryConsumption,
      profitability: {
        quotedRevenue: quoted,
        invoicedRevenue,
        receivedPayment,
        outstandingReceivable,
        cogs,
        inventoryConsumedCost,
        additionalCosts,
        grossProfit,
        netProfit,
        grossMarginPercent,
        netMarginPercent,
      },
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
        updatedAt: new Date(),
      })
      .where(and(eq(projects.id, projectRow.id), ne(projects.status, "completed")))
      .returning({ id: projects.id });

    if (updated.length === 0) return false;

    // Refresh actualTotal from costs ledger.
    const [sumRow] = await tx
      .select({
        total:
          sql<string>`coalesce(sum(case when ${projectCosts.isReversed} = false then ${projectCosts.amount}::numeric else 0 end), 0)`.as(
            "total",
          ),
      })
      .from(projectCosts)
      .where(eq(projectCosts.projectId, projectRow.id));
    const total = Math.round(Number(sumRow?.total ?? 0));
    await tx
      .update(projects)
      .set({ actualTotal: toDbDecimal(total), updatedAt: new Date() })
      .where(eq(projects.id, projectRow.id));

    // Seed default warranty alerts.
    const now = new Date();
    const alertsToInsert: (typeof warrantyAlerts.$inferInsert)[] = [];

    if (projectRow.quotationId) {
      const items = await tx
        .select({
          name: inventoryItems.name,
          durationMonths: inventoryItems.durationMonths,
          category: inventoryItems.category,
        })
        .from(quotationItems)
        .innerJoin(inventoryItems, eq(quotationItems.itemId, inventoryItems.id))
        .where(
          and(
            eq(quotationItems.quotationId, projectRow.quotationId),
            inArray(inventoryItems.category, ["panel", "inverter", "service"]),
          ),
        );

      let panelAlertAdded = false;
      let inverterAlertAdded = false;

      for (const item of items) {
        if (item.category === "service" && item.durationMonths > 0) {
          alertsToInsert.push({
            projectId: projectRow.id,
            alertType: "maintenance_due",
            description: `Service Due: ${item.name}`,
            dueDate: addMonths(now, item.durationMonths),
            isResolved: false,
          });
        } else if (item.category === "panel" && !panelAlertAdded) {
          const months = item.durationMonths > 0 ? item.durationMonths : 12;
          alertsToInsert.push({
            projectId: projectRow.id,
            alertType: "warranty_expiry",
            description: "Panel Warranty Check",
            dueDate: addMonths(now, months),
            isResolved: false,
          });
          panelAlertAdded = true;
        } else if (item.category === "inverter" && !inverterAlertAdded) {
          const months = item.durationMonths > 0 ? item.durationMonths : 12;
          alertsToInsert.push({
            projectId: projectRow.id,
            alertType: "warranty_expiry",
            description: "Inverter Warranty Check",
            dueDate: addMonths(now, months),
            isResolved: false,
          });
          inverterAlertAdded = true;
        }
      }

      if (!panelAlertAdded) {
        alertsToInsert.push({
          projectId: projectRow.id,
          alertType: "warranty_expiry",
          description: "Panel Warranty Check",
          dueDate: addYears(now, 1),
          isResolved: false,
        });
      }

      if (!inverterAlertAdded) {
        alertsToInsert.push({
          projectId: projectRow.id,
          alertType: "warranty_expiry",
          description: "Inverter Warranty Check",
          dueDate: addYears(now, 1),
          isResolved: false,
        });
      }
    } else {
      alertsToInsert.push(
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
      );
    }

    if (alertsToInsert.filter((a) => a.alertType === "maintenance_due").length === 0) {
      alertsToInsert.push({
        projectId: projectRow.id,
        alertType: "maintenance_due",
        description: "System Maintenance",
        dueDate: addMonths(now, 6),
        isResolved: false,
      });
    }

    // M-5: Use onConflictDoNothing() so concurrent completion calls that race past the
    // status-update guard simply skip duplicate active alerts rather than throwing a
    // unique-violation error. The DB unique partial index enforces the constraint.
    await tx.insert(warrantyAlerts).values(alertsToInsert).onConflictDoNothing();

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

    const hasMetadataChanges =
      (data.siteAddress !== undefined && data.siteAddress.trim() !== existing.siteAddress) ||
      (data.systemSizeKwp !== undefined && data.systemSizeKwp !== Number(existing.systemSizeKwp)) ||
      (data.targetCompletion !== undefined &&
        data.targetCompletion?.toISOString() !== existing.targetCompletion?.toISOString());

    if (hasMetadataChanges && auth.role !== "admin") {
      return handleStateError("Only admins can modify project metadata.");
    }

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
        const patch: Partial<typeof projects.$inferInsert> = {};
        if (data.siteAddress !== undefined) {
          patch.siteAddress = data.siteAddress?.trim() || existing.siteAddress;
        }
        if (data.systemSizeKwp !== undefined) {
          patch.systemSizeKwp = toDbDecimal(data.systemSizeKwp);
        }
        if (data.targetCompletion !== undefined) {
          patch.targetCompletion = data.targetCompletion;
        }
        if (data.notes !== undefined) patch.notes = data.notes;

        if (Object.keys(patch).length > 0) {
          await db
            .update(projects)
            .set({ ...patch, updatedAt: new Date() })
            .where(eq(projects.id, data.id));
        }

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
          patch.systemSizeKwp = toDbDecimal(data.systemSizeKwp);
        }
        if (data.targetCompletion !== undefined) {
          patch.targetCompletion = data.targetCompletion;
        }
        if (data.notes !== undefined) patch.notes = data.notes;
        await db
          .update(projects)
          .set({ ...patch, updatedAt: new Date() })
          .where(eq(projects.id, data.id));

        await notifyAllUsers({
          title: "Project status changed",
          message: `Project ${existing.projectNumber} moved from ${existing.status.replaceAll("_", " ")} to ${data.status.replaceAll("_", " ")}.`,
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
        patch.systemSizeKwp = toDbDecimal(data.systemSizeKwp);
      }
      if (data.targetCompletion !== undefined) {
        patch.targetCompletion = data.targetCompletion;
      }
      if (data.notes !== undefined) patch.notes = data.notes;
      if (Object.keys(patch).length > 0) {
        await db
          .update(projects)
          .set({ ...patch, updatedAt: new Date() })
          .where(eq(projects.id, data.id));
      }
    }

    const updated = await db.query.projects.findFirst({
      where: eq(projects.id, data.id),
    });
    if (!updated) return handleNotFoundError("Project", data.id);

    revalidateTag(CACHE_TAGS.DASHBOARD_STATS, "max");
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
      return handleStateError(
        "Project must be in Installation Completed state before final completion.",
      );
    }

    await applyProjectCompletion(existing);

    const updated = await db.query.projects.findFirst({
      where: eq(projects.id, validatedId),
    });
    if (!updated) return handleNotFoundError("Project", validatedId);

    revalidateTag(CACHE_TAGS.DASHBOARD_STATS, "max");
    revalidatePath("/projects");
    revalidatePath(`/projects/${validatedId}`);
    revalidatePath("/projects/completed");
    revalidatePath("/warranty");

    return successResponse(updated);
  } catch (error) {
    return handleActionError(error, "markProjectCompleted", "Failed to complete project");
  }
}

export async function checkProjectCompletionOutstanding(
  id: string,
): Promise<ActionResponse<{ outstanding: number; willWarn: boolean }>> {
  try {
    await requireAuth();
    const validatedId = uuidSchema.parse(id);

    const [arRow] = await db
      .select({
        balance:
          sql<number>`coalesce(sum(${journalLines.debit}::numeric) - sum(${journalLines.credit}::numeric), 0)`.as(
            "balance",
          ),
      })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .innerJoin(ledgerAccounts, eq(journalLines.accountId, ledgerAccounts.id))
      .where(
        and(
          eq(journalLines.projectId, validatedId),
          eq(ledgerAccounts.code, "accounts_receivable"),
          eq(journalEntries.isReversed, false),
        ),
      );

    const outstanding = Math.round(Number(arRow?.balance ?? 0));
    return successResponse({
      outstanding,
      willWarn: outstanding > 0,
    });
  } catch (error) {
    return handleActionError(
      error,
      "checkProjectCompletionOutstanding",
      "Failed to check outstanding balance",
    );
  }
}

export async function addProjectCost(raw: unknown): Promise<ActionResponse<ProjectCost[]>> {
  try {
    const auth = await requireFinanceAccess();
    assertFinanceSsotDrift();
    const data = addProjectCostSchema.parse(raw);
    if (data.itemId) {
      return handleStateError("Use inventory consumption to attach inventory items to a project.");
    }

    const projectRow = await db.query.projects.findFirst({
      where: eq(projects.id, data.projectId),
    });
    if (!projectRow) return handleNotFoundError("Project", data.projectId);
    if (
      projectRow.status === "on_hold" ||
      projectRow.status === "installation_completed" ||
      projectRow.status === "completed" ||
      projectRow.status === "cancelled"
    ) {
      return handleStateError("Cannot add costs to on-hold, completed, or cancelled projects.");
    }

    let actualSpend = 0;
    const amountRounded = Math.round(data.amount);
    await db.transaction(async (tx) => {
      const [createdCost] = await tx
        .insert(projectCosts)
        .values({
          projectId: data.projectId,
          itemId: data.itemId ?? null,
          paymentMethodId: data.paymentMethodId,
          description: data.description,
          amount: String(amountRounded),
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

      actualSpend = await persistActualTotal(data.projectId, tx);
    });

    const previousSpend = actualSpend - amountRounded;
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

export async function consumeProjectInventory(
  raw: unknown,
): Promise<ActionResponse<ProjectCost[]>> {
  try {
    const auth = await requireFinanceAccess();
    assertFinanceSsotDrift();
    const data = consumeProjectInventorySchema.parse(raw);

    const projectRow = await db.query.projects.findFirst({
      where: eq(projects.id, data.projectId),
    });
    if (!projectRow) return handleNotFoundError("Project", data.projectId);
    if (
      projectRow.status === "on_hold" ||
      projectRow.status === "installation_completed" ||
      projectRow.status === "completed" ||
      projectRow.status === "cancelled"
    ) {
      return handleStateError(
        "Cannot consume inventory on on-hold, completed, or cancelled projects.",
      );
    }

    let actualSpend = 0;
    let consumedAmount = 0;
    await db.transaction(async (tx) => {
      const result = await postInventoryConsumptionToProject({
        tx,
        projectId: data.projectId,
        inventoryItemId: data.inventoryItemId,
        quantity: data.quantity,
        description: data.description,
        incurredDate: data.incurredDate,
        createdBy: auth.userId,
      });

      actualSpend = result.actualSpend;
      consumedAmount = result.consumedAmount;
    });

    const costs = await db.query.projectCosts.findMany({
      where: eq(projectCosts.projectId, data.projectId),
      orderBy: [desc(projectCosts.incurredDate)],
    });

    await maybeNotifyBudgetOverrun(
      data.projectId,
      Math.round(Number(projectRow.quotedTotal)),
      actualSpend - consumedAmount,
      actualSpend,
    );

    revalidatePath(`/projects/${data.projectId}`);
    revalidatePath("/projects");
    revalidatePath("/inventory");

    return successResponse(costs);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "inventory_not_found") {
        return handleStateError("Inventory item not found.");
      }
      if (error.message === "inventory_inactive") {
        return handleStateError("Inventory item is inactive.");
      }
      if (error.message === "insufficient_stock") {
        return handleStateError("Insufficient stock for requested consumption quantity.");
      }
      if (error.message === "inventory_cost_required") {
        return handleStateError("Inventory item must have a positive cost before consumption.");
      }
    }
    return handleActionError(
      error,
      "consumeProjectInventory",
      "Failed to consume inventory for project",
    );
  }
}

export async function deleteProjectCost(
  costId: string,
): Promise<ActionResponse<{ projectId: string }>> {
  try {
    const auth = await requireFinanceAccess();
    const validatedCostId = uuidSchema.parse(costId);
    const cost = await db.query.projectCosts.findFirst({
      where: eq(projectCosts.id, validatedCostId),
    });
    if (!cost) return handleNotFoundError("Cost record", validatedCostId);

    // Guard: block deletion on completed or cancelled projects.
    // NOTE: on_hold and installation_completed are intentionally NOT blocked here.
    // New costs cannot be added to those states, but existing costs may be corrected
    // (e.g. data-entry errors discovered during hold). This asymmetry is deliberate.
    const projectRow = await db.query.projects.findFirst({
      where: eq(projects.id, cost.projectId),
      columns: { status: true },
    });
    if (projectRow?.status === "completed" || projectRow?.status === "cancelled") {
      return handleStateError("Cannot delete costs from completed or cancelled projects.");
    }

    await db.transaction(async (tx) => {
      const journalEntry = await tx.query.journalEntries.findFirst({
        where: and(
          inArray(journalEntries.sourceType, ["project_expense", "inventory_consumption"]),
          eq(journalEntries.sourceId, validatedCostId),
          eq(journalEntries.isReversed, false),
        ),
      });

      if (journalEntry) {
        await assertJournalEntryNotReversed(tx, journalEntry.id);
        // M-4: Reuse the `auth` captured at function entry — avoids a redundant DB round-trip
        // and ensures the journal reversal is attributed to the same authenticated user.
        await reverseJournalEntry({
          tx,
          originalEntryId: journalEntry.id,
          createdBy: auth.userId,
        });
      }

      // C-2: cost.quantity is integer | null in the schema (column has no NOT NULL).
      // Explicitly narrow to a non-null, positive integer before arithmetic to prevent
      // NaN stock values (item.stockQty + null === NaN, which bypasses the DB CHECK
      // constraint since Postgres treats NaN > 0 as false).
      const qty = cost.quantity;
      if (cost.itemId && qty !== null && qty > 0) {
        const item = await tx.query.inventoryItems.findFirst({
          where: eq(inventoryItems.id, cost.itemId),
        });
        if (item) {
          await tx
            .update(inventoryItems)
            .set({
              stockQty: item.stockQty + qty,
              updatedAt: new Date(),
            })
            .where(eq(inventoryItems.id, cost.itemId));
        }
      }

      await tx
        .update(projectCosts)
        .set({ isReversed: true })
        .where(eq(projectCosts.id, validatedCostId));

      await persistActualTotal(cost.projectId, tx);
    });

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

    revalidateTag(CACHE_TAGS.DASHBOARD_STATS, "max");
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
