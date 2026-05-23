"use server";

import { addDays } from "date-fns";
import { and, count, desc, eq, ilike, inArray, lt, sql } from "drizzle-orm";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { requireAdmin, requireAuth } from "@/lib/auth/validate";
import { db } from "@/lib/db";
import {
  type Customer,
  inventoryItems,
  projects,
  type Quotation,
  type QuotationItem,
  quotationItems,
  quotations,
} from "@/lib/db/schema";
import { notifyAllUsers } from "@/lib/notifications/broadcast";
import { calculateLineItem, calculateQuotation, type LineItem } from "@/lib/pricing/engine";
import { type ActionResponse, errorResponse, successResponse } from "@/lib/utils/action-response";
import { AdvisoryLock } from "@/lib/utils/advisory-lock";
import { handleActionError, handleNotFoundError, handleStateError } from "@/lib/utils/error";
import { extractSequence, formatQuoteNumber } from "@/lib/utils/quote-number";
import { uuidSchema } from "@/lib/validators/common";
import {
  canTransitionStatus,
  createQuotationSchema,
  type QuotationFilterInput,
  type QuotationStatus,
  quotationFilterSchema,
  updateQuotationSchema,
} from "@/lib/validators/quotation";

export type QuotationWithCustomer = Quotation & {
  customer: {
    name: string;
  };
  createdBy: {
    name: string;
  };
};

const getCachedQuotationsPage = unstable_cache(
  async (
    status: QuotationStatus | null | undefined,
    customerId: string | null | undefined,
    archived: boolean | null | undefined,
    page: number,
    limit: number,
  ): Promise<{ items: QuotationWithCustomer[]; total: number }> => {
    return fetchQuotationsPage({
      status,
      customerId,
      archived,
      page,
      limit,
    });
  },
  ["quotations:list-page"],
  { tags: ["quotations:list"], revalidate: 300 },
);

type QuotationsPageParams = {
  status: QuotationStatus | null | undefined;
  customerId: string | null | undefined;
  archived: boolean | null | undefined;
  page: number;
  limit: number;
  search?: string | null | undefined;
};

function buildQuotationsWhere({
  status,
  customerId,
  archived,
  search,
}: Omit<QuotationsPageParams, "page" | "limit">): ReturnType<typeof and> {
  return and(
    status ? eq(quotations.status, status) : undefined,
    archived !== null && archived !== undefined
      ? eq(quotations.isArchived, archived)
      : eq(quotations.isArchived, false),
    customerId ? eq(quotations.customerId, customerId) : undefined,
    search ? ilike(quotations.quoteNumber, `%${search}%`) : undefined,
  );
}

async function fetchQuotationsPage({
  status,
  customerId,
  archived,
  page,
  limit,
  search,
}: QuotationsPageParams): Promise<{
  items: QuotationWithCustomer[];
  total: number;
}> {
  const offset = (page - 1) * limit;
  const whereClause = buildQuotationsWhere({
    status,
    customerId,
    archived,
    search,
  });

  const [items, totals] = await Promise.all([
    db.query.quotations.findMany({
      where: whereClause,
      with: {
        customer: {
          columns: {
            name: true,
          },
        },
        createdBy: {
          columns: {
            name: true,
          },
        },
      },
      orderBy: [desc(quotations.createdAt)],
      limit,
      offset,
    }),
    db.select({ total: count() }).from(quotations).where(whereClause),
  ]);
  const total = totals[0]?.total ?? 0;
  return { items, total };
}

export async function getQuotations(
  filters: QuotationFilterInput = {},
): Promise<ActionResponse<{ items: QuotationWithCustomer[]; total: number }>> {
  try {
    await requireAuth();

    const parsedFilters = quotationFilterSchema.parse(filters);
    const { status, customerId, search, archived, page, limit } = parsedFilters;

    const hasSearch = Boolean(search && search.trim().length > 0);
    const data = hasSearch
      ? await fetchQuotationsPage({
          status,
          customerId,
          search,
          archived,
          page,
          limit,
        })
      : await getCachedQuotationsPage(status, customerId, archived, page, limit);

    return successResponse(data);
  } catch (error) {
    return handleActionError(error, "getQuotations", "Failed to fetch quotations");
  }
}

export async function getQuotation(id: string): Promise<
  ActionResponse<
    Quotation & {
      items: QuotationItem[];
      customer: Customer;
      project: { id: string; projectNumber: string } | null;
    }
  >
> {
  try {
    await requireAuth();
    const validatedId = uuidSchema.parse(id);

    // NOTE: auto-expire is handled by `expireOverdueQuotations()` running on
    // a schedule. Doing it here on every read costs a write round-trip for no
    // benefit and creates write amplification under load.
    const item = await db.query.quotations.findFirst({
      where: eq(quotations.id, validatedId),
      with: {
        items: true,
        customer: true,
        project: {
          columns: {
            id: true,
            projectNumber: true,
          },
        },
      },
    });

    if (!item) {
      return handleNotFoundError("Quotation", id);
    }

    return successResponse(item);
  } catch (error) {
    return handleActionError(error, "getQuotation", "Failed to fetch quotation");
  }
}

export async function createQuotation(raw: unknown): Promise<ActionResponse<Quotation>> {
  try {
    const auth = await requireAuth();

    const validated = createQuotationSchema.parse(raw);

    const lineItems: LineItem[] = validated.items.map((item) => ({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountPercentage: item.discountPercentage,
    }));

    const pricing = calculateQuotation(lineItems, validated.discountPercent, validated.taxPercent);

    const lockKey = BigInt(0x42_4f_42_53); // 'BOBS'
    const yearStart = new Date(new Date().getFullYear(), 0, 1);
    let retries = 3;

    while (retries > 0) {
      try {
        const result = await db.transaction(async (tx) => {
          // Advisory lock MUST run on the same connection as the insert.
          // Drizzle's transaction pins a single connection, so taking the
          // lock inside `tx` is what makes this actually serialize.
          const lock = new AdvisoryLock(tx, lockKey);
          const acquired = await lock.acquire();
          if (!acquired) {
            throw Object.assign(new Error("Too many concurrent requests – please try again"), {
              code: "LOCK_BUSY",
            });
          }

          try {
            const lastQuote = await tx.query.quotations.findFirst({
              where: and(sql`${quotations.createdAt} >= ${yearStart}`),
              orderBy: [desc(quotations.createdAt)],
            });

            let nextSequence = 1;
            if (lastQuote) {
              nextSequence = extractSequence(lastQuote.quoteNumber) + 1;
            }
            const quoteNumber = formatQuoteNumber(nextSequence);

            const [quote] = await tx
              .insert(quotations)
              .values({
                quoteNumber,
                customerId: validated.customerId,
                createdBy: auth.userId,
                subtotal: pricing.subtotal.toString(),
                discountPercent: validated.discountPercent.toString(),
                discountAmount: pricing.discountAmount.toString(),
                taxPercent: validated.taxPercent.toString(),
                taxAmount: pricing.taxAmount.toString(),
                total: pricing.total.toString(),
                notes: validated.notes,
                validUntil: validated.validUntil,
                createdAt: validated.quotationDate ?? undefined,
                status: "draft",
              })
              .returning();

            if (!quote) throw new Error("Failed to create quotation record in database");

            // Look up cost prices for inventory-linked items
            const itemIds = validated.items
              .map((item) => item.itemId)
              .filter((id): id is string => id != null);

            const costPriceMap = new Map<string, number>();
            if (itemIds.length > 0) {
              const inventoryRows = await tx
                .select({ id: inventoryItems.id, costPrice: inventoryItems.costPrice })
                .from(inventoryItems)
                .where(inArray(inventoryItems.id, itemIds));
              for (const row of inventoryRows) {
                costPriceMap.set(row.id, Math.round(Number(row.costPrice)));
              }
            }

            const itemsToInsert = validated.items.map((item, index) => {
              const itemCostPrice = item.itemId ? (costPriceMap.get(item.itemId) ?? 0) : 0;
              return {
                quotationId: quote.id,
                itemId: item.itemId,
                description: item.description,
                quantity: item.quantity.toString(),
                unitPrice: item.unitPrice.toString(),
                costPrice: String(itemCostPrice),
                discountPercentage: item.discountPercentage.toString(),
                totalPrice: calculateLineItem({
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  discountPercentage: item.discountPercentage,
                }).toString(),
                costTotal: String(Math.round(itemCostPrice * item.quantity)),
                sortOrder: index,
              };
            });

            await tx.insert(quotationItems).values(itemsToInsert);
            return quote;
          } finally {
            await lock.release();
          }
        });

        revalidateTag("quotations:list", "default");
        revalidateTag("dashboard:stats", "default");
        revalidatePath("/quotations");
        return successResponse(result);
      } catch (error: unknown) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code: string }).code === "23505" &&
          retries > 1
        ) {
          retries--;
          continue;
        }
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code: string }).code === "LOCK_BUSY"
        ) {
          return handleStateError("Too many concurrent requests – please try again");
        }
        throw error;
      }
    }

    return handleStateError("Failed to generate unique quote number after retries.");
  } catch (error) {
    return handleActionError(error, "createQuotation", "Failed to create quotation");
  }
}

export async function updateQuotationStatus(
  id: string,
  status: QuotationStatus,
): Promise<ActionResponse<null>> {
  try {
    await requireAuth();
    const validatedId = uuidSchema.parse(id);

    const quote = await db.query.quotations.findFirst({
      where: eq(quotations.id, validatedId),
    });

    if (!quote) return handleNotFoundError("Quotation", validatedId);

    const linkedProject = await db.query.projects.findFirst({
      where: eq(projects.quotationId, validatedId),
    });

    // Once a quotation is converted to a project, its status becomes immutable
    // to prevent inconsistent states (e.g. project exists but quote is rejected).
    if (linkedProject && status !== quote.status) {
      return handleStateError(
        "Cannot change quotation status - it has already been converted to a project",
      );
    }

    if (!canTransitionStatus(quote.status, status)) {
      return handleStateError(`Cannot change status from "${quote.status}" to "${status}"`);
    }

    await db
      .update(quotations)
      .set({ status, updatedAt: new Date() })
      .where(eq(quotations.id, validatedId));

    if (status === "accepted") {
      await notifyAllUsers({
        title: "Quotation accepted",
        message: `${quote.quoteNumber} has been accepted.`,
        type: "action",
        link: `/quotations/${validatedId}`,
      });
    }

    revalidateTag("quotations:list", "default");
    revalidateTag("dashboard:stats", "default");
    revalidatePath("/quotations");
    revalidatePath(`/quotations/${validatedId}`);
    return successResponse(null);
  } catch (error) {
    return handleActionError(error, "updateQuotationStatus", "Failed to update quotation status");
  }
}

export async function updateQuotation(
  id: string,
  raw: unknown,
): Promise<ActionResponse<Quotation>> {
  try {
    await requireAuth();
    const validatedId = uuidSchema.parse(id);

    const quote = await db.query.quotations.findFirst({
      where: eq(quotations.id, validatedId),
      with: { items: true },
    });

    if (!quote) return handleNotFoundError("Quotation", validatedId);
    if (quote.status !== "draft") {
      return handleStateError("Only draft quotations can be updated");
    }

    const validated = updateQuotationSchema.parse(raw);

    const patch: Partial<typeof quotations.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (validated.customerId !== undefined) patch.customerId = validated.customerId;
    if (validated.notes !== undefined) patch.notes = validated.notes;
    if (validated.validUntil !== undefined) patch.validUntil = validated.validUntil;

    let shouldRecalculatePricing = false;
    if (validated.items !== undefined) shouldRecalculatePricing = true;
    if (validated.discountPercent !== undefined) {
      patch.discountPercent = validated.discountPercent.toString();
      shouldRecalculatePricing = true;
    }
    if (validated.taxPercent !== undefined) {
      patch.taxPercent = validated.taxPercent.toString();
      shouldRecalculatePricing = true;
    }

    if (shouldRecalculatePricing) {
      const lineItems: LineItem[] = validated.items
        ? validated.items.map((item) => ({
            quantity: item.quantity || 0,
            unitPrice: item.unitPrice || 0,
            discountPercentage: item.discountPercentage || 0,
          }))
        : quote.items.map((item) => ({
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            discountPercentage: Number(item.discountPercentage || 0),
          }));

      const dPct =
        validated.discountPercent !== undefined
          ? validated.discountPercent
          : Number(quote.discountPercent);
      const tPct =
        validated.taxPercent !== undefined ? validated.taxPercent : Number(quote.taxPercent);

      const pricing = calculateQuotation(lineItems, dPct, tPct);

      patch.subtotal = pricing.subtotal.toString();
      patch.discountAmount = pricing.discountAmount.toString();
      patch.taxAmount = pricing.taxAmount.toString();
      patch.total = pricing.total.toString();
    }

    await db.transaction(async (tx) => {
      if (Object.keys(patch).length > 0) {
        await tx.update(quotations).set(patch).where(eq(quotations.id, id));
      }

      if (validated.items) {
        await tx.delete(quotationItems).where(eq(quotationItems.quotationId, id));

        // Look up cost prices for inventory-linked items
        const updateItemIds = validated.items
          .map((item) => item.itemId)
          .filter((itemId): itemId is string => itemId != null);

        const updateCostMap = new Map<string, number>();
        if (updateItemIds.length > 0) {
          const invRows = await tx
            .select({ id: inventoryItems.id, costPrice: inventoryItems.costPrice })
            .from(inventoryItems)
            .where(inArray(inventoryItems.id, updateItemIds));
          for (const row of invRows) {
            updateCostMap.set(row.id, Math.round(Number(row.costPrice)));
          }
        }

        const itemsToInsert = validated.items.map((item, index) => {
          const itemCostPrice = item.itemId ? (updateCostMap.get(item.itemId) ?? 0) : 0;
          return {
            quotationId: id,
            itemId: item.itemId,
            description: item.description,
            quantity: item.quantity.toString(),
            unitPrice: item.unitPrice.toString(),
            costPrice: String(itemCostPrice),
            discountPercentage: item.discountPercentage.toString(),
            totalPrice: calculateLineItem({
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discountPercentage: item.discountPercentage,
            }).toString(),
            costTotal: String(Math.round(itemCostPrice * item.quantity)),
            sortOrder: index,
          };
        });

        await tx.insert(quotationItems).values(itemsToInsert);
      }
    });

    revalidateTag("quotations:list", "default");
    revalidateTag("dashboard:stats", "default");
    revalidatePath("/quotations");
    revalidatePath(`/quotations/${validatedId}`);

    const updated = await db.query.quotations.findFirst({
      where: eq(quotations.id, validatedId),
    });

    if (!updated) return handleNotFoundError("Quotation", validatedId);

    return successResponse(updated);
  } catch (error) {
    return handleActionError(error, "updateQuotation", "Failed to update quotation");
  }
}

export async function duplicateQuotation(id: string): Promise<ActionResponse<Quotation>> {
  try {
    const auth = await requireAuth();
    const validatedId = uuidSchema.parse(id);

    const original = await db.query.quotations.findFirst({
      where: eq(quotations.id, validatedId),
      with: { items: true },
    });

    if (!original) return handleNotFoundError("Quotation", validatedId);

    const lockKey = BigInt(0x42_4f_42_53); // 'BOBS'
    const yearStart = new Date(new Date().getFullYear(), 0, 1);
    let retries = 3;

    while (retries > 0) {
      try {
        const result = await db.transaction(async (tx) => {
          const lock = new AdvisoryLock(tx, lockKey);
          const acquired = await lock.acquire();
          if (!acquired) {
            throw Object.assign(new Error("Too many concurrent requests – please try again"), {
              code: "LOCK_BUSY",
            });
          }

          try {
            const lastQuote = await tx.query.quotations.findFirst({
              where: and(sql`${quotations.createdAt} >= ${yearStart}`),
              orderBy: [desc(quotations.createdAt)],
            });

            let nextSequence = 1;
            if (lastQuote) {
              nextSequence = extractSequence(lastQuote.quoteNumber) + 1;
            }
            const quoteNumber = formatQuoteNumber(nextSequence);

            const [quote] = await tx
              .insert(quotations)
              .values({
                quoteNumber,
                customerId: original.customerId,
                createdBy: auth.userId,
                subtotal: original.subtotal,
                discountPercent: original.discountPercent,
                discountAmount: original.discountAmount,
                taxPercent: original.taxPercent,
                taxAmount: original.taxAmount,
                total: original.total,
                notes: original.notes,
                validUntil: original.validUntil ? addDays(new Date(), 30) : null,
                status: "draft",
              })
              .returning();

            if (!quote) throw new Error("Failed to create duplicated quotation in database");

            const itemsToInsert = original.items.map((item, index) => ({
              quotationId: quote.id,
              itemId: item.itemId,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              costPrice: item.costPrice,
              discountPercentage: item.discountPercentage,
              totalPrice: item.totalPrice,
              costTotal: item.costTotal,
              sortOrder: index,
            }));

            await tx.insert(quotationItems).values(itemsToInsert);
            return quote;
          } finally {
            await lock.release();
          }
        });

        revalidateTag("quotations:list", "default");
        revalidateTag("dashboard:stats", "default");
        revalidatePath("/quotations");
        return successResponse(result);
      } catch (error: unknown) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code: string }).code === "23505" &&
          retries > 1
        ) {
          retries--;
          continue;
        }
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code: string }).code === "LOCK_BUSY"
        ) {
          return handleStateError("Too many concurrent requests – please try again");
        }
        throw error;
      }
    }

    return handleStateError("Failed to duplicate quote after retries.");
  } catch (error) {
    return handleActionError(error, "duplicateQuotation", "Failed to duplicate quotation");
  }
}

export async function deleteQuotation(id: string): Promise<ActionResponse<null>> {
  try {
    const session = await requireAuth();
    const validatedId = uuidSchema.parse(id);

    const existing = await db.query.quotations.findFirst({
      where: eq(quotations.id, validatedId),
    });

    if (!existing) return handleNotFoundError("Quotation", validatedId);

    // Only allow deleting drafts
    if (existing.status !== "draft") {
      return handleStateError("Only draft quotations can be deleted");
    }

    // Only creator or admin can delete
    if (existing.createdBy !== session.userId && session.role !== "admin") {
      return errorResponse("Unauthorized to delete this quotation");
    }

    await db.delete(quotations).where(eq(quotations.id, validatedId));

    revalidateTag("quotations:list", "default");
    revalidateTag("dashboard:stats", "default");
    revalidatePath("/quotations");
    revalidatePath("/", "layout");
    return successResponse(null);
  } catch (error) {
    return handleActionError(error, "deleteQuotation", "Failed to delete quotation");
  }
}

export async function archiveQuotation(id: string): Promise<ActionResponse<null>> {
  try {
    await requireAuth();
    const validatedId = uuidSchema.parse(id);

    const quote = await db.query.quotations.findFirst({
      where: eq(quotations.id, validatedId),
    });
    if (!quote) return handleNotFoundError("Quotation", validatedId);
    if (quote.status !== "rejected") {
      return handleStateError("Only rejected quotations can be archived");
    }

    await db
      .update(quotations)
      .set({ isArchived: true, archivedAt: new Date(), updatedAt: new Date() })
      .where(eq(quotations.id, validatedId));

    revalidateTag("quotations:list", "default");
    revalidateTag("dashboard:stats", "default");
    revalidatePath("/quotations");
    revalidatePath(`/quotations/${validatedId}`);
    return successResponse(null);
  } catch (error) {
    return handleActionError(error, "archiveQuotation", "Failed to archive quotation");
  }
}

export async function restoreQuotation(id: string): Promise<ActionResponse<null>> {
  try {
    await requireAuth();
    const validatedId = uuidSchema.parse(id);

    const quote = await db.query.quotations.findFirst({
      where: eq(quotations.id, validatedId),
    });
    if (!quote) return handleNotFoundError("Quotation", validatedId);

    await db
      .update(quotations)
      .set({ isArchived: false, archivedAt: null, updatedAt: new Date() })
      .where(eq(quotations.id, validatedId));

    revalidateTag("quotations:list", "default");
    revalidateTag("dashboard:stats", "default");
    revalidatePath("/quotations");
    revalidatePath(`/quotations/${validatedId}`);
    return successResponse(null);
  } catch (error) {
    return handleActionError(error, "restoreQuotation", "Failed to restore quotation");
  }
}

/**
 * Bulk auto-expire: sweeps quotations whose `validUntil` has passed while
 * they are still in `sent` status. Designed for cron / scheduled invocation
 * (e.g. Vercel Cron Jobs). Replaces the previous write-on-read pattern that
 * mutated state on every detail-page hit.
 */
export async function expireOverdueQuotations(): Promise<ActionResponse<{ expired: number }>> {
  try {
    await requireAdmin();
    const result = await db
      .update(quotations)
      .set({ status: "expired", updatedAt: new Date() })
      .where(and(eq(quotations.status, "sent"), lt(quotations.validUntil, new Date())))
      .returning({ id: quotations.id });

    if (result.length > 0) {
      revalidateTag("quotations:list", "default");
      revalidateTag("dashboard:stats", "default");
      revalidatePath("/quotations");
    }
    return successResponse({ expired: result.length });
  } catch (error) {
    return handleActionError(
      error,
      "expireOverdueQuotations",
      "Failed to expire overdue quotations",
    );
  }
}
