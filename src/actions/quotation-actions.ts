"use server";

import { addDays } from "date-fns";
import { and, asc, count, desc, eq, ilike, inArray, lt, or, sql } from "drizzle-orm";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { requireAdmin, requireAuth, requireOwner } from "@/lib/auth/validate";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import {
  type Customer,
  customers,
  inventoryItems,
  projects,
  type Quotation,
  type QuotationItem,
  type QuotationStatus,
  quotationItems,
  quotations,
} from "@/lib/db/schema";
import { canTransitionQuotationStatus } from "@/lib/domain/quotation";
import { notifyAllUsers } from "@/lib/notifications/broadcast";
import { calculateLineItem, calculateQuotation, type LineItem } from "@/lib/pricing/engine";
import { type ActionResponse, errorResponse, successResponse } from "@/lib/utils/action-response";
import { AdvisoryLock } from "@/lib/utils/advisory-lock";
import { handleActionError, handleNotFoundError, handleStateError } from "@/lib/utils/error";
import { extractQuoteSequence, formatQuoteNumber } from "@/lib/utils/quote-number";
import { escapeLikePattern } from "@/lib/utils/search";
import { toDbDecimal, uuidSchema } from "@/lib/validators/common";
import {
  createQuotationRevisionSchema,
  createQuotationSchema,
  type QuotationFilterInput,
  quotationFilterSchema,
  updateQuotationSchema,
} from "@/lib/validators/quotation";

function _quotationWithCustomerQuery() {
  return db.query.quotations.findFirst({
    with: {
      customer: { columns: { name: true } },
      createdBy: { columns: { name: true } },
    },
  });
}

export type QuotationWithCustomer = NonNullable<
  Awaited<ReturnType<typeof _quotationWithCustomerQuery>>
>;

const getCachedQuotationsPage = unstable_cache(
  async (
    status: QuotationStatus | null | undefined,
    customerId: string | null | undefined,
    isArchived: boolean | null | undefined,
    page: number,
    limit: number,
  ): Promise<{ items: QuotationWithCustomer[]; total: number }> => {
    return fetchQuotationsPage({
      status,
      customerId,
      isArchived,
      page,
      limit,
    });
  },
  ["quotations:list-page"],
  { tags: [CACHE_TAGS.QUOTATIONS_LIST], revalidate: 300 },
);

type QuotationsPageParams = {
  status: QuotationStatus | null | undefined;
  customerId: string | null | undefined;
  isArchived: boolean | null | undefined;
  page: number;
  limit: number;
  search?: string | null | undefined;
};

function buildQuotationsWhere({
  status,
  customerId,
  isArchived,
  search,
}: Omit<QuotationsPageParams, "page" | "limit">): ReturnType<typeof and> {
  return and(
    status ? eq(quotations.status, status) : undefined,
    isArchived !== null && isArchived !== undefined
      ? eq(quotations.isArchived, isArchived)
      : eq(quotations.isArchived, false),
    customerId ? eq(quotations.customerId, customerId) : undefined,
    search ? ilike(quotations.quoteNumber, `%${escapeLikePattern(search)}%`) : undefined,
  );
}

async function fetchQuotationsPage({
  status,
  customerId,
  isArchived,
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
    isArchived,
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
    const { status, customerId, search, isArchived, page, limit } = parsedFilters;

    const hasSearch = Boolean(search && search.trim().length > 0);
    const data = hasSearch
      ? await fetchQuotationsPage({
          status,
          customerId,
          search,
          isArchived,
          page,
          limit,
        })
      : await getCachedQuotationsPage(status, customerId, isArchived, page, limit);

    return successResponse(data);
  } catch (error) {
    return handleActionError(error, "getQuotations", "Failed to fetch quotations");
  }
}

export async function getQuotation(id: string): Promise<
  ActionResponse<
    Quotation & {
      items: (QuotationItem & {
        inventoryItem: { category: string } | null;
      })[];
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
        items: {
          with: {
            inventoryItem: {
              columns: {
                category: true,
              },
            },
          },
        },
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
    const auth = await requireOwner();

    const validated = createQuotationSchema.parse(raw);
    const customer = await db.query.customers.findFirst({
      where: eq(customers.id, validated.customerId),
      columns: {
        id: true,
        isArchived: true,
      },
    });
    if (!customer || customer.isArchived) {
      return handleStateError("Customer not found or archived");
    }

    if (auth.role !== "admin") {
      if (validated.discountPercent !== undefined && validated.discountPercent > 15) {
        return errorResponse("Standard users cannot apply a global discount greater than 15%");
      }
      for (const item of validated.items) {
        if (item.discountPercentage !== undefined && item.discountPercentage > 15) {
          return errorResponse("Standard users cannot apply an item discount greater than 15%");
        }
      }
    }

    const itemIds = validated.items
      .map((item) => item.itemId)
      .filter((id): id is string => id != null);

    const unitPriceMap = new Map<string, number>();
    if (itemIds.length > 0) {
      const invRows = await db
        .select({ id: inventoryItems.id, unitPrice: inventoryItems.unitPrice })
        .from(inventoryItems)
        .where(inArray(inventoryItems.id, itemIds));
      for (const row of invRows) {
        unitPriceMap.set(row.id, Number(row.unitPrice));
      }
    }

    const enrichedItems = validated.items.map((item) => ({
      ...item,
      unitPrice: item.itemId ? (unitPriceMap.get(item.itemId) ?? item.unitPrice) : item.unitPrice,
    }));

    const lineItems: LineItem[] = enrichedItems.map((item) => ({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountPercentage: item.discountPercentage,
    }));

    const pricing = calculateQuotation(lineItems, validated.discountPercent, validated.taxPercent);

    const yearStart = new Date(new Date().getFullYear(), 0, 1);
    const lockKey = BigInt(0x42_4f_42_53) + BigInt(yearStart.getFullYear());
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

          const lastQuote = await tx.query.quotations.findFirst({
            where: and(sql`${quotations.createdAt} >= ${yearStart}`),
            orderBy: [desc(quotations.createdAt)],
          });

          let nextSequence = 1;
          if (lastQuote) {
            nextSequence = extractQuoteSequence(lastQuote.quoteNumber) + 1;
          }
          const quoteNumber = formatQuoteNumber(nextSequence);

          const [quote] = await tx
            .insert(quotations)
            .values({
              quoteNumber,
              customerId: validated.customerId,
              createdBy: auth.userId,
              subtotal: toDbDecimal(pricing.subtotal),
              discountPercent: toDbDecimal(validated.discountPercent),
              discountAmount: toDbDecimal(pricing.discountAmount),
              taxPercent: toDbDecimal(validated.taxPercent),
              taxAmount: toDbDecimal(pricing.taxAmount),
              total: toDbDecimal(pricing.total),
              notes: validated.notes,
              validUntil: validated.validUntil,
              quotationDate: validated.quotationDate ?? undefined,
              status: "draft",
            })
            .returning();

          if (!quote) throw new Error("Failed to create quotation record in database");

          // Look up cost prices for inventory-linked items
          const costLookupItemIds = enrichedItems
            .map((item) => item.itemId)
            .filter((id): id is string => id != null);

          const costPriceMap = new Map<string, number>();
          if (costLookupItemIds.length > 0) {
            const inventoryRows = await tx
              .select({ id: inventoryItems.id, costPrice: inventoryItems.costPrice })
              .from(inventoryItems)
              .where(inArray(inventoryItems.id, costLookupItemIds));
            for (const row of inventoryRows) {
              costPriceMap.set(row.id, Math.round(Number(row.costPrice)));
            }
          }

          const itemsToInsert = enrichedItems.map((item, index) => {
            const itemCostPrice = item.itemId ? (costPriceMap.get(item.itemId) ?? 0) : 0;
            return {
              quotationId: quote.id,
              itemId: item.itemId,
              description: item.description,
              quantity: toDbDecimal(item.quantity),
              unitPrice: toDbDecimal(item.unitPrice),
              costPrice: toDbDecimal(itemCostPrice),
              discountPercentage: toDbDecimal(item.discountPercentage),
              totalPrice: toDbDecimal(
                calculateLineItem({
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  discountPercentage: item.discountPercentage,
                }),
              ),
              costTotal: toDbDecimal(Math.round(itemCostPrice * item.quantity)),
              sortOrder: index,
            };
          });

          await tx.insert(quotationItems).values(itemsToInsert);
          return quote;
        });

        revalidateTag(CACHE_TAGS.QUOTATIONS_LIST, "max");
        revalidateTag(CACHE_TAGS.DASHBOARD_STATS, "max");
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

    if (!canTransitionQuotationStatus(quote.status, status)) {
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

    revalidateTag(CACHE_TAGS.QUOTATIONS_LIST, "max");
    revalidateTag(CACHE_TAGS.DASHBOARD_STATS, "max");
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
    const auth = await requireAuth();
    const validatedId = uuidSchema.parse(id);

    const validated = updateQuotationSchema.parse(raw);

    // Block edits on quotations already linked to a project — the quote's
    // pricing is frozen once a project is created from it.
    const linkedProject = await db.query.projects.findFirst({
      where: eq(projects.quotationId, validatedId),
      columns: { id: true },
    });
    if (linkedProject) {
      return handleStateError(
        "Cannot edit quotation — it has already been converted to a project.",
      );
    }

    // Discount validation BEFORE transaction — these checks don't need DB access
    // and must not be inside db.transaction() where `return errorResponse(...)` would
    // return from the callback, silently discarding the error.
    if (auth.role !== "admin") {
      if (validated.discountPercent !== undefined && validated.discountPercent > 15) {
        return errorResponse("Standard users cannot apply a global discount greater than 15%");
      }
      if (validated.items) {
        for (const item of validated.items) {
          if (item.discountPercentage !== undefined && item.discountPercentage > 15) {
            return errorResponse("Standard users cannot apply an item discount greater than 15%");
          }
        }
      }
    }

    const updated = await db.transaction(async (tx) => {
      const lockedQuotes = await tx
        .select()
        .from(quotations)
        .where(eq(quotations.id, validatedId))
        .for("update");

      const quote = lockedQuotes[0];
      if (!quote) throw new Error("QUOTATION_NOT_FOUND");
      if (quote.status !== "draft" && quote.status !== "sent") {
        throw new Error("Only draft and sent quotations can be updated");
      }

      const quoteItemsData = await tx
        .select()
        .from(quotationItems)
        .where(eq(quotationItems.quotationId, validatedId));

      let enrichedItems = validated.items;
      if (validated.items) {
        const updateItemIds = validated.items
          .map((item) => item.itemId)
          .filter((id): id is string => id != null);

        const unitPriceMap = new Map<string, number>();
        if (updateItemIds.length > 0) {
          const invRows = await tx
            .select({ id: inventoryItems.id, unitPrice: inventoryItems.unitPrice })
            .from(inventoryItems)
            .where(inArray(inventoryItems.id, updateItemIds));
          for (const row of invRows) {
            unitPriceMap.set(row.id, Number(row.unitPrice));
          }
        }

        enrichedItems = validated.items.map((item) => ({
          ...item,
          unitPrice: item.itemId
            ? (unitPriceMap.get(item.itemId) ?? item.unitPrice)
            : item.unitPrice,
        }));
      }

      const patch: Partial<typeof quotations.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (validated.customerId !== undefined) patch.customerId = validated.customerId;
      if (validated.notes !== undefined) patch.notes = validated.notes;
      if (validated.validUntil !== undefined) patch.validUntil = validated.validUntil;
      if (validated.quotationDate !== undefined) patch.quotationDate = validated.quotationDate;

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
        const lineItems: LineItem[] = enrichedItems
          ? enrichedItems.map((item) => ({
              quantity: item.quantity || 0,
              unitPrice: item.unitPrice || 0,
              discountPercentage: item.discountPercentage || 0,
            }))
          : quoteItemsData.map((item) => ({
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

        patch.subtotal = toDbDecimal(pricing.subtotal);
        patch.discountAmount = toDbDecimal(pricing.discountAmount);
        patch.taxAmount = toDbDecimal(pricing.taxAmount);
        patch.total = toDbDecimal(pricing.total);
      }

      if (Object.keys(patch).length > 0) {
        await tx.update(quotations).set(patch).where(eq(quotations.id, validatedId));
      }

      if (enrichedItems) {
        await tx.delete(quotationItems).where(eq(quotationItems.quotationId, validatedId));

        // Look up cost prices for inventory-linked items
        const updateItemIds = enrichedItems
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

        const itemsToInsert = enrichedItems.map((item, index) => {
          const itemCostPrice = item.itemId ? (updateCostMap.get(item.itemId) ?? 0) : 0;
          return {
            quotationId: validatedId,
            itemId: item.itemId,
            description: item.description,
            quantity: toDbDecimal(item.quantity),
            unitPrice: toDbDecimal(item.unitPrice),
            costPrice: toDbDecimal(itemCostPrice),
            discountPercentage: toDbDecimal(item.discountPercentage),
            totalPrice: toDbDecimal(
              calculateLineItem({
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discountPercentage: item.discountPercentage,
              }),
            ),
            costTotal: toDbDecimal(Math.round(itemCostPrice * item.quantity)),
            sortOrder: index,
          };
        });

        await tx.insert(quotationItems).values(itemsToInsert);
      }

      const [updated] = await tx.select().from(quotations).where(eq(quotations.id, validatedId));

      return updated;
    });

    revalidateTag(CACHE_TAGS.QUOTATIONS_LIST, "max");
    revalidateTag(CACHE_TAGS.DASHBOARD_STATS, "max");
    revalidatePath("/quotations");
    revalidatePath(`/quotations/${validatedId}`);

    if (!updated) return handleNotFoundError("Quotation", validatedId);

    return successResponse(updated);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "QUOTATION_NOT_FOUND") return handleNotFoundError("Quotation", id);
      if (error.message === "Only draft and sent quotations can be updated")
        return handleStateError(error.message);
    }
    return handleActionError(error, "updateQuotation", "Failed to update quotation");
  }
}

export async function duplicateQuotation(id: string): Promise<ActionResponse<Quotation>> {
  try {
    const auth = await requireOwner();
    const validatedId = uuidSchema.parse(id);

    const original = await db.query.quotations.findFirst({
      where: eq(quotations.id, validatedId),
      with: { items: true },
    });

    if (!original) return handleNotFoundError("Quotation", validatedId);

    const yearStart = new Date(new Date().getFullYear(), 0, 1);
    const lockKey = BigInt(0x42_4f_42_53) + BigInt(yearStart.getFullYear());
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

          const lastQuote = await tx.query.quotations.findFirst({
            where: and(sql`${quotations.createdAt} >= ${yearStart}`),
            orderBy: [desc(quotations.createdAt)],
          });

          let nextSequence = 1;
          if (lastQuote) {
            nextSequence = extractQuoteSequence(lastQuote.quoteNumber) + 1;
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
              quotationDate: original.quotationDate ?? undefined,
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
        });

        revalidateTag(CACHE_TAGS.QUOTATIONS_LIST, "max");
        revalidateTag(CACHE_TAGS.DASHBOARD_STATS, "max");
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

    // Only allow deleting drafts and sent quotations
    if (existing.status !== "draft" && existing.status !== "sent") {
      return handleStateError("Only draft and sent quotations can be deleted");
    }

    // Only creator or admin can delete
    if (existing.createdBy !== session.userId && session.role !== "admin") {
      return errorResponse("Unauthorized to delete this quotation");
    }

    await db
      .update(quotations)
      .set({ isArchived: true, archivedAt: new Date(), updatedAt: new Date() })
      .where(eq(quotations.id, validatedId));

    revalidateTag(CACHE_TAGS.QUOTATIONS_LIST, "max");
    revalidateTag(CACHE_TAGS.DASHBOARD_STATS, "max");
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

    revalidateTag(CACHE_TAGS.QUOTATIONS_LIST, "max");
    revalidateTag(CACHE_TAGS.DASHBOARD_STATS, "max");
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
    if (!quote.isArchived) {
      return handleStateError("Quotation is not archived — nothing to restore");
    }

    await db
      .update(quotations)
      .set({ isArchived: false, archivedAt: null, updatedAt: new Date() })
      .where(eq(quotations.id, validatedId));

    revalidateTag(CACHE_TAGS.QUOTATIONS_LIST, "max");
    revalidateTag(CACHE_TAGS.DASHBOARD_STATS, "max");
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
      revalidateTag(CACHE_TAGS.QUOTATIONS_LIST, "max");
      revalidateTag(CACHE_TAGS.DASHBOARD_STATS, "max");
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

export async function createQuotationRevision(raw: unknown): Promise<ActionResponse<Quotation>> {
  try {
    const auth = await requireOwner();
    const data = createQuotationRevisionSchema.parse(raw);

    const original = await db.query.quotations.findFirst({
      where: eq(quotations.id, data.originalQuotationId),
      with: { items: true },
    });

    if (!original) {
      return handleNotFoundError("Quotation", data.originalQuotationId);
    }

    if (original.status !== "sent" && original.status !== "rejected") {
      return handleStateError("Only sent or rejected quotations can be revised");
    }

    // Standard user limit validations if not admin
    if (auth.role !== "admin") {
      if (data.discountPercent !== undefined && data.discountPercent > 15) {
        return errorResponse("Standard users cannot apply a global discount greater than 15%");
      }
      for (const item of data.items) {
        if (item.discountPercentage !== undefined && item.discountPercentage > 15) {
          return errorResponse("Standard users cannot apply an item discount greater than 15%");
        }
      }
    }

    const itemIds = data.items.map((item) => item.itemId).filter((id): id is string => id != null);

    const unitPriceMap = new Map<string, number>();
    if (itemIds.length > 0) {
      const invRows = await db
        .select({ id: inventoryItems.id, unitPrice: inventoryItems.unitPrice })
        .from(inventoryItems)
        .where(inArray(inventoryItems.id, itemIds));
      for (const row of invRows) {
        unitPriceMap.set(row.id, Number(row.unitPrice));
      }
    }

    const enrichedItems = data.items.map((item) => ({
      ...item,
      unitPrice: item.itemId ? (unitPriceMap.get(item.itemId) ?? item.unitPrice) : item.unitPrice,
    }));

    const lineItems: LineItem[] = enrichedItems.map((item) => ({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountPercentage: item.discountPercentage,
    }));

    const pricing = calculateQuotation(lineItems, data.discountPercent, data.taxPercent);

    const revisionNumber = original.revisionNumber + 1;
    const originalQuotationId = original.originalQuotationId ?? original.id;

    // Revision quote number format: QT-{YEAR}-{SEQ}-R{REV}
    const baseQuoteNumber = original.quoteNumber.split("-R")[0] ?? original.quoteNumber;
    const quoteNumber = `${baseQuoteNumber}-R${revisionNumber}`;

    const result = await db.transaction(async (tx) => {
      const [quote] = await tx
        .insert(quotations)
        .values({
          quoteNumber,
          customerId: data.customerId,
          createdBy: auth.userId,
          subtotal: toDbDecimal(pricing.subtotal),
          discountPercent: toDbDecimal(data.discountPercent),
          discountAmount: toDbDecimal(pricing.discountAmount),
          taxPercent: toDbDecimal(data.taxPercent),
          taxAmount: toDbDecimal(pricing.taxAmount),
          total: toDbDecimal(pricing.total),
          notes: data.notes,
          validUntil: data.validUntil,
          quotationDate: data.quotationDate ?? undefined,
          status: "draft",
          revisionNumber,
          originalQuotationId,
          revisionReason: data.revisionReason,
        })
        .returning();

      if (!quote) throw new Error("Failed to create revised quotation record in database");

      const costLookupItemIds = enrichedItems
        .map((item) => item.itemId)
        .filter((id): id is string => id != null);

      const costPriceMap = new Map<string, number>();
      if (costLookupItemIds.length > 0) {
        const inventoryRows = await tx
          .select({ id: inventoryItems.id, costPrice: inventoryItems.costPrice })
          .from(inventoryItems)
          .where(inArray(inventoryItems.id, costLookupItemIds));
        for (const row of inventoryRows) {
          costPriceMap.set(row.id, Math.round(Number(row.costPrice)));
        }
      }

      const itemsToInsert = enrichedItems.map((item, index) => {
        const itemCostPrice = item.itemId ? (costPriceMap.get(item.itemId) ?? 0) : 0;
        return {
          quotationId: quote.id,
          itemId: item.itemId,
          description: item.description,
          quantity: toDbDecimal(item.quantity),
          unitPrice: toDbDecimal(item.unitPrice),
          costPrice: toDbDecimal(itemCostPrice),
          discountPercentage: toDbDecimal(item.discountPercentage),
          totalPrice: toDbDecimal(
            calculateLineItem({
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discountPercentage: item.discountPercentage,
            }),
          ),
          costTotal: toDbDecimal(Math.round(itemCostPrice * item.quantity)),
          sortOrder: index,
        };
      });

      await tx.insert(quotationItems).values(itemsToInsert);
      return quote;
    });

    revalidateTag(CACHE_TAGS.QUOTATIONS_LIST, "max");
    revalidateTag(CACHE_TAGS.DASHBOARD_STATS, "max");
    revalidatePath("/quotations");
    return successResponse(result);
  } catch (error) {
    return handleActionError(error, "createQuotationRevision", "Failed to revise quotation");
  }
}

export async function getQuotationRevisions(id: string): Promise<ActionResponse<Quotation[]>> {
  try {
    await requireAuth();
    const validatedId = uuidSchema.parse(id);

    const quote = await db.query.quotations.findFirst({
      where: eq(quotations.id, validatedId),
    });

    if (!quote) return handleNotFoundError("Quotation", validatedId);

    const rootId = quote.originalQuotationId ?? quote.id;

    // Fetch the root quotation + all revisions order by revisionNumber asc
    const revisionsList = await db.query.quotations.findMany({
      where: and(
        eq(quotations.isArchived, false),
        or(eq(quotations.id, rootId), eq(quotations.originalQuotationId, rootId)),
      ),
      orderBy: [asc(quotations.revisionNumber)],
    });

    return successResponse(revisionsList);
  } catch (error) {
    return handleActionError(error, "getQuotationRevisions", "Failed to fetch quotation revisions");
  }
}
