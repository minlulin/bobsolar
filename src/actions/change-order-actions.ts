"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { requireOwner } from "@/lib/auth/validate";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import {
  type ProjectChangeOrder,
  type ProjectChangeOrderItem,
  projectChangeOrderItems,
  projectChangeOrders,
  projects,
} from "@/lib/db/schema";
import { canTransitionChangeOrderStatus, isChangeOrderStatus } from "@/lib/domain/change-order";
import { invalidateFinanceCacheForWrite } from "@/lib/finance/cache-invalidation";
import { createBalancedJournalEntry } from "@/lib/finance/ledger";
import { type ActionResponse, successResponse } from "@/lib/utils/action-response";
import { AdvisoryLock } from "@/lib/utils/advisory-lock";
import { handleActionError, handleNotFoundError, handleStateError } from "@/lib/utils/error";
import { createChangeOrderSchema } from "@/lib/validators/change-order";
import { toDbDecimal } from "@/lib/validators/common";

function uuidToBigInt(uuid: string): bigint {
  const hex = uuid.replace(/-/g, "");
  return BigInt(`0x${hex.slice(0, 16)}`);
}

export async function createChangeOrder(raw: unknown): Promise<ActionResponse<ProjectChangeOrder>> {
  try {
    const auth = await requireOwner();
    const data = createChangeOrderSchema.parse(raw);

    const result = await db.transaction(async (tx) => {
      // Find the project
      const [project] = await tx
        .select()
        .from(projects)
        .where(eq(projects.id, data.projectId))
        .for("update");

      if (!project) {
        throw new Error(`PROJECT_NOT_FOUND:${data.projectId}`);
      }

      if (project.status === "completed" || project.status === "cancelled") {
        throw new Error("CANNOT_CREATE_CO_ON_CLOSED_PROJECT");
      }

      // Lock on project ID to serialize sequence generation
      const lock = new AdvisoryLock(tx, uuidToBigInt(data.projectId));
      const hasLock = await lock.acquire();
      if (!hasLock) {
        throw new Error("LOCK_ACQUISITION_FAILED");
      }

      // Calculate sequential number
      const existingCos = await tx
        .select({ id: projectChangeOrders.id })
        .from(projectChangeOrders)
        .where(eq(projectChangeOrders.projectId, data.projectId));
      const nextSeq = existingCos.length + 1;
      const changeOrderNumber = `${project.projectNumber}-CO-${nextSeq}`;

      // Calculate total amount of this change order
      const additionalAmount = data.items.reduce((sum, item) => {
        const lineVal = Math.round(item.quantity * item.unitPrice);
        return sum + (item.isAddition ? lineVal : -lineVal);
      }, 0);

      // Insert change order record
      const [co] = await tx
        .insert(projectChangeOrders)
        .values({
          projectId: data.projectId,
          changeOrderNumber,
          description: data.description,
          additionalAmount: toDbDecimal(additionalAmount),
          status: "draft",
          originalQuotationId: data.originalQuotationId ?? null,
          createdBy: auth.userId,
        })
        .returning();

      if (!co) {
        throw new Error("CHANGE_ORDER_INSERT_FAILED");
      }

      // Insert change order items
      const itemsToInsert = data.items.map((item) => ({
        changeOrderId: co.id,
        itemId: item.itemId ?? null,
        description: item.description,
        quantity: toDbDecimal(item.quantity),
        unitPrice: toDbDecimal(item.unitPrice),
        totalPrice: toDbDecimal(Math.round(item.quantity * item.unitPrice)),
        isAddition: item.isAddition,
      }));

      await tx.insert(projectChangeOrderItems).values(itemsToInsert);

      return co;
    });

    revalidateTag(CACHE_TAGS.PROJECTS_LIST, "max");
    revalidatePath(`/projects/${data.projectId}`);
    return successResponse(result);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("PROJECT_NOT_FOUND:")) {
      const id = error.message.split(":")[1] ?? "";
      return handleNotFoundError("Project", id);
    }
    if (error instanceof Error && error.message === "CANNOT_CREATE_CO_ON_CLOSED_PROJECT") {
      return handleStateError("Cannot create change orders on completed or cancelled projects");
    }
    return handleActionError(error, "createChangeOrder", "Failed to create change order");
  }
}

export async function approveChangeOrder(
  changeOrderId: string,
): Promise<ActionResponse<ProjectChangeOrder>> {
  try {
    const auth = await requireOwner();

    const result = await db.transaction(async (tx) => {
      const [co] = await tx
        .select()
        .from(projectChangeOrders)
        .where(eq(projectChangeOrders.id, changeOrderId))
        .for("update");

      if (!co) {
        throw new Error(`CHANGE_ORDER_NOT_FOUND:${changeOrderId}`);
      }

      if (!isChangeOrderStatus(co.status)) {
        throw new Error(`INVALID_STATUS:${co.status}`);
      }
      if (!canTransitionChangeOrderStatus(co.status, "approved")) {
        throw new Error(`INVALID_STATUS_TRANSITION:${co.status}`);
      }

      const [project] = await tx
        .select()
        .from(projects)
        .where(eq(projects.id, co.projectId))
        .for("update");

      if (!project) {
        throw new Error(`PROJECT_NOT_FOUND:${co.projectId}`);
      }

      if (project.status === "completed" || project.status === "cancelled") {
        throw new Error("CANNOT_APPROVE_CO_ON_CLOSED_PROJECT");
      }

      // Update status to approved
      const [updatedCo] = await tx
        .update(projectChangeOrders)
        .set({
          status: "approved",
          approvedBy: auth.userId,
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(projectChangeOrders.id, changeOrderId))
        .returning();

      if (!updatedCo) {
        throw new Error("CHANGE_ORDER_UPDATE_FAILED");
      }

      // Recalculate project actualTotal
      const approvedCOs = await tx
        .select({ amount: projectChangeOrders.additionalAmount })
        .from(projectChangeOrders)
        .where(
          and(
            eq(projectChangeOrders.projectId, co.projectId),
            eq(projectChangeOrders.status, "approved"),
          ),
        );

      const totalCOAmount = approvedCOs.reduce((sum, item) => sum + Number(item.amount), 0);
      const newActualTotal = Math.round(Number(project.quotedTotal) + totalCOAmount);

      await tx
        .update(projects)
        .set({
          actualTotal: toDbDecimal(newActualTotal),
          updatedAt: new Date(),
        })
        .where(eq(projects.id, co.projectId));

      // Post balanced journal entry for the change order value
      const additionalAmountVal = Math.round(Number(co.additionalAmount));
      if (additionalAmountVal !== 0) {
        const isPositive = additionalAmountVal > 0;
        const absVal = Math.abs(additionalAmountVal);

        await createBalancedJournalEntry({
          tx,
          entryDate: new Date(),
          memo: `Change Order ${co.changeOrderNumber}: ${co.description}`,
          sourceType: "project_change_order",
          sourceId: co.id,
          projectId: co.projectId,
          createdBy: auth.userId,
          lines: isPositive
            ? [
                { accountCode: "accounts_receivable", debit: absVal, credit: 0 },
                { accountCode: "solar_installation_revenue", debit: 0, credit: absVal },
              ]
            : [
                { accountCode: "solar_installation_revenue", debit: absVal, credit: 0 },
                { accountCode: "accounts_receivable", debit: 0, credit: absVal },
              ],
        });
      }

      return updatedCo;
    });

    invalidateFinanceCacheForWrite();
    revalidateTag(CACHE_TAGS.PROJECTS_LIST, "max");
    revalidateTag(CACHE_TAGS.DASHBOARD_STATS, "max");
    revalidateTag(CACHE_TAGS.FINANCE_REPORTS, "max");
    revalidatePath(`/projects/${result.projectId}`);
    return successResponse(result);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("CHANGE_ORDER_NOT_FOUND:")) {
      const id = error.message.split(":")[1] ?? "";
      return handleNotFoundError("Change Order", id);
    }
    if (error instanceof Error && error.message.startsWith("INVALID_STATUS_TRANSITION:")) {
      const status = error.message.split(":")[1] ?? "";
      return handleStateError(`Cannot approve change order in ${status} status`);
    }
    if (error instanceof Error && error.message === "CANNOT_APPROVE_CO_ON_CLOSED_PROJECT") {
      return handleStateError("Cannot approve change orders on completed or cancelled projects");
    }
    return handleActionError(error, "approveChangeOrder", "Failed to approve change order");
  }
}

export async function rejectChangeOrder(
  changeOrderId: string,
): Promise<ActionResponse<ProjectChangeOrder>> {
  try {
    await requireOwner();

    const result = await db.transaction(async (tx) => {
      const [co] = await tx
        .select()
        .from(projectChangeOrders)
        .where(eq(projectChangeOrders.id, changeOrderId))
        .for("update");

      if (!co) {
        throw new Error(`CHANGE_ORDER_NOT_FOUND:${changeOrderId}`);
      }

      if (!isChangeOrderStatus(co.status)) {
        throw new Error(`INVALID_STATUS:${co.status}`);
      }
      if (!canTransitionChangeOrderStatus(co.status, "rejected")) {
        throw new Error(`INVALID_STATUS_TRANSITION:${co.status}`);
      }

      const [updatedCo] = await tx
        .update(projectChangeOrders)
        .set({
          status: "rejected",
          updatedAt: new Date(),
        })
        .where(eq(projectChangeOrders.id, changeOrderId))
        .returning();

      if (!updatedCo) {
        throw new Error("CHANGE_ORDER_UPDATE_FAILED");
      }

      return updatedCo;
    });

    revalidateTag(CACHE_TAGS.PROJECTS_LIST, "max");
    revalidatePath(`/projects/${result.projectId}`);
    return successResponse(result);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("CHANGE_ORDER_NOT_FOUND:")) {
      const id = error.message.split(":")[1] ?? "";
      return handleNotFoundError("Change Order", id);
    }
    if (error instanceof Error && error.message.startsWith("INVALID_STATUS_TRANSITION:")) {
      const status = error.message.split(":")[1] ?? "";
      return handleStateError(`Cannot reject change order in ${status} status`);
    }
    return handleActionError(error, "rejectChangeOrder", "Failed to reject change order");
  }
}

export async function cancelChangeOrder(
  changeOrderId: string,
): Promise<ActionResponse<ProjectChangeOrder>> {
  try {
    const auth = await requireOwner();

    const result = await db.transaction(async (tx) => {
      const [co] = await tx
        .select()
        .from(projectChangeOrders)
        .where(eq(projectChangeOrders.id, changeOrderId))
        .for("update");

      if (!co) {
        throw new Error(`CHANGE_ORDER_NOT_FOUND:${changeOrderId}`);
      }

      if (!isChangeOrderStatus(co.status)) {
        throw new Error(`INVALID_STATUS:${co.status}`);
      }
      if (!canTransitionChangeOrderStatus(co.status, "cancelled")) {
        throw new Error(`INVALID_STATUS_TRANSITION:${co.status}`);
      }

      const [project] = await tx
        .select()
        .from(projects)
        .where(eq(projects.id, co.projectId))
        .for("update");

      if (!project) {
        throw new Error(`PROJECT_NOT_FOUND:${co.projectId}`);
      }

      if (project.status === "completed" || project.status === "cancelled") {
        throw new Error("CANNOT_CANCEL_CO_ON_CLOSED_PROJECT");
      }

      // Update status to cancelled
      const [updatedCo] = await tx
        .update(projectChangeOrders)
        .set({
          status: "cancelled",
          updatedAt: new Date(),
        })
        .where(eq(projectChangeOrders.id, changeOrderId))
        .returning();

      if (!updatedCo) {
        throw new Error("CHANGE_ORDER_UPDATE_FAILED");
      }

      // Recalculate project actualTotal
      const approvedCOs = await tx
        .select({ amount: projectChangeOrders.additionalAmount })
        .from(projectChangeOrders)
        .where(
          and(
            eq(projectChangeOrders.projectId, co.projectId),
            eq(projectChangeOrders.status, "approved"),
          ),
        );

      const totalCOAmount = approvedCOs.reduce((sum, item) => sum + Number(item.amount), 0);
      const newActualTotal = Math.round(Number(project.quotedTotal) + totalCOAmount);

      await tx
        .update(projects)
        .set({
          actualTotal: toDbDecimal(newActualTotal),
          updatedAt: new Date(),
        })
        .where(eq(projects.id, co.projectId));

      // Post reverse balanced journal entry
      const additionalAmountVal = Math.round(Number(co.additionalAmount));
      if (additionalAmountVal !== 0) {
        const isPositive = additionalAmountVal > 0;
        const absVal = Math.abs(additionalAmountVal);

        await createBalancedJournalEntry({
          tx,
          entryDate: new Date(),
          memo: `Cancellation of Change Order ${co.changeOrderNumber}`,
          sourceType: "project_change_order",
          sourceId: co.id,
          projectId: co.projectId,
          createdBy: auth.userId,
          lines: isPositive
            ? [
                { accountCode: "solar_installation_revenue", debit: absVal, credit: 0 },
                { accountCode: "accounts_receivable", debit: 0, credit: absVal },
              ]
            : [
                { accountCode: "accounts_receivable", debit: absVal, credit: 0 },
                { accountCode: "solar_installation_revenue", debit: 0, credit: absVal },
              ],
        });
      }

      return updatedCo;
    });

    invalidateFinanceCacheForWrite();
    revalidateTag(CACHE_TAGS.PROJECTS_LIST, "max");
    revalidateTag(CACHE_TAGS.DASHBOARD_STATS, "max");
    revalidateTag(CACHE_TAGS.FINANCE_REPORTS, "max");
    revalidatePath(`/projects/${result.projectId}`);
    return successResponse(result);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("CHANGE_ORDER_NOT_FOUND:")) {
      const id = error.message.split(":")[1] ?? "";
      return handleNotFoundError("Change Order", id);
    }
    if (error instanceof Error && error.message.startsWith("INVALID_STATUS_TRANSITION:")) {
      const status = error.message.split(":")[1] ?? "";
      return handleStateError(`Cannot cancel change order in ${status} status (must be approved)`);
    }
    if (error instanceof Error && error.message === "CANNOT_CANCEL_CO_ON_CLOSED_PROJECT") {
      return handleStateError("Cannot cancel change orders on completed or cancelled projects");
    }
    return handleActionError(error, "cancelChangeOrder", "Failed to cancel change order");
  }
}

export async function getProjectChangeOrders(
  projectId: string,
): Promise<ActionResponse<(ProjectChangeOrder & { items: ProjectChangeOrderItem[] })[]>> {
  try {
    await requireOwner();

    const cos = await db.query.projectChangeOrders.findMany({
      where: eq(projectChangeOrders.projectId, projectId),
      with: {
        items: true,
      },
      orderBy: (co, { desc }) => [desc(co.createdAt)],
    });

    return successResponse(cos);
  } catch (error) {
    return handleActionError(
      error,
      "getProjectChangeOrders",
      "Failed to fetch project change orders",
    );
  }
}
