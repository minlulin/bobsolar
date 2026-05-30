"use server";

import { and, asc, count, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { z } from "zod";
import { requireAdmin, requireAuth } from "@/lib/auth/validate";
import { deleteCacheValue } from "@/lib/cache";
import { db } from "@/lib/db";
import { type InventoryItem, inventoryItems } from "@/lib/db/schema";
import { extractBrandModel } from "@/lib/domain/inventory";
import { type ActionResponse, errorResponse, successResponse } from "@/lib/utils/action-response";
import { handleActionError } from "@/lib/utils/error";
import { withIdempotency } from "@/lib/utils/idempotency";
import { toDbDecimal, uuidSchema } from "@/lib/validators/common";
import {
  createInventoryItemSchema,
  inventoryFilterSchema,
  updateInventoryItemPayloadSchema,
} from "@/lib/validators/inventory";

const getCachedInventoryPage = unstable_cache(
  async (
    category: InventoryItem["category"] | null | undefined,
    search: string | null | undefined,
    isActive: boolean | null,
    page: number,
    limit: number,
  ): Promise<{ items: InventoryItem[]; total: number }> => {
    const offset = (page - 1) * limit;
    const escapedSearch = search?.replace(/%/g, "\\%").replace(/_/g, "\\_");
    const where = and(
      isActive !== null ? eq(inventoryItems.isActive, isActive) : undefined,
      category ? eq(inventoryItems.category, category) : undefined,
      escapedSearch
        ? or(
            ilike(inventoryItems.name, `%${escapedSearch}%`),
            ilike(inventoryItems.brand, `%${escapedSearch}%`),
            ilike(inventoryItems.modelNumber, `%${escapedSearch}%`),
          )
        : undefined,
    );

    const items = await db.query.inventoryItems.findMany({
      where,
      orderBy: [asc(inventoryItems.name)],
      limit,
      offset,
    });

    const totals = await db.select({ total: count() }).from(inventoryItems).where(where);
    const total = totals[0]?.total ?? 0;

    return { items, total };
  },
  ["inventory:list-page"],
  { tags: ["inventory:list"], revalidate: 300 },
);

export async function getInventoryItems(
  rawFilters: unknown = {},
): Promise<ActionResponse<{ items: InventoryItem[]; total: number }>> {
  try {
    await requireAuth();

    const filters = inventoryFilterSchema.parse(rawFilters);
    const { category, search, isActive = true, page, limit } = filters;

    const data = await getCachedInventoryPage(category, search, isActive, page, limit);

    return successResponse(data);
  } catch (error) {
    return handleActionError(error, "getInventoryItems", "Failed to fetch inventory items");
  }
}

export async function getInventoryItem(id: string): Promise<ActionResponse<InventoryItem>> {
  try {
    await requireAuth();
    const validatedId = uuidSchema.parse(id);

    const item = await db.query.inventoryItems.findFirst({
      where: eq(inventoryItems.id, validatedId),
    });

    if (!item) {
      return errorResponse("Item not found");
    }

    return successResponse(item);
  } catch (error) {
    return handleActionError(error, "getInventoryItem", "Failed to fetch inventory item");
  }
}

export async function createInventoryItem(raw: unknown): Promise<ActionResponse<InventoryItem>> {
  try {
    const session = await requireAdmin();
    const validated = createInventoryItemSchema.parse(raw);

    const extracted = extractBrandModel(
      validated.category,
      validated.specifications,
      validated.brand,
      validated.modelNumber,
    );

    return await withIdempotency("createInventoryItem", session.userId, validated, async () => {
      const [item] = await db
        .insert(inventoryItems)
        .values({
          ...validated,
          durationMonths: validated.durationMonths ?? 0,
          brand: extracted.brand || null,
          modelNumber: extracted.modelNumber || null,
          costPrice: toDbDecimal(validated.costPrice),
          unitPrice: toDbDecimal(validated.unitPrice),
        })
        .returning();

      if (!item) {
        return errorResponse("Failed to create inventory item");
      }
      await deleteCacheValue("inventory:categories");

      revalidateTag("inventory:list", "max");
      revalidatePath("/inventory");
      return successResponse(item);
    });
  } catch (error) {
    return handleActionError(error, "createInventoryItem", "Failed to create inventory item");
  }
}

export async function updateInventoryItem(
  id: string,
  raw: unknown,
): Promise<ActionResponse<InventoryItem>> {
  try {
    await requireAdmin();
    const validatedId = uuidSchema.parse(id);

    const validated = updateInventoryItemPayloadSchema.parse({
      ...(typeof raw === "object" && raw !== null ? raw : {}),
      id: validatedId,
    });

    const { id: parsedId, ...updateData } = validated;
    void parsedId;

    const extracted = extractBrandModel(
      updateData.category ?? "",
      updateData.specifications,
      updateData.brand,
      updateData.modelNumber,
    );

    const dbUpdateData: Record<string, unknown> = {
      ...updateData,
      durationMonths: updateData.durationMonths ?? undefined,
    };

    if (updateData.brand !== undefined) dbUpdateData["brand"] = extracted.brand || null;
    if (updateData.modelNumber !== undefined)
      dbUpdateData["modelNumber"] = extracted.modelNumber || null;
    if (updateData.costPrice !== undefined)
      dbUpdateData["costPrice"] = toDbDecimal(updateData.costPrice);
    if (updateData.unitPrice !== undefined)
      dbUpdateData["unitPrice"] = toDbDecimal(updateData.unitPrice);

    const [item] = await db
      .update(inventoryItems)
      .set({
        ...dbUpdateData,
        updatedAt: new Date(),
      })
      .where(eq(inventoryItems.id, validatedId))
      .returning();

    if (!item) {
      return errorResponse("Item not found or failed to update");
    }
    await deleteCacheValue("inventory:categories");

    revalidateTag("inventory:list", "max");
    revalidatePath("/inventory");
    return successResponse(item);
  } catch (error) {
    return handleActionError(error, "updateInventoryItem", "Failed to update inventory item");
  }
}

export async function deleteInventoryItem(id: string): Promise<ActionResponse<null>> {
  try {
    await requireAdmin();
    const validatedId = uuidSchema.parse(id);

    await db
      .update(inventoryItems)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(inventoryItems.id, validatedId));
    await deleteCacheValue("inventory:categories");

    revalidateTag("inventory:list", "max");
    revalidatePath("/inventory");
    return successResponse(null);
  } catch (error) {
    return handleActionError(error, "deleteInventoryItem", "Failed to delete inventory item");
  }
}

const bulkUpdateSchema = z.array(
  z.object({
    id: z.uuid(),
    costPrice: z.number().min(0, "Cost price must be positive").optional(),
    unitPrice: z.number().min(0, "Unit price must be positive"),
  }),
);

export async function bulkUpdatePrices(rawUpdates: unknown): Promise<ActionResponse<null>> {
  try {
    await requireAdmin();

    const updates = bulkUpdateSchema.parse(rawUpdates);
    if (updates.length === 0) {
      return successResponse(null);
    }

    await db.transaction(async (tx) => {
      const ids = updates.map((u) => u.id);

      const unitPriceSqlChunks = updates.map(
        (u) => sql`WHEN id = ${u.id} THEN ${toDbDecimal(u.unitPrice)}::numeric`,
      );
      const costPriceSqlChunks = updates
        .filter((u): u is typeof u & { costPrice: number } => u.costPrice !== undefined)
        .map((u) => sql`WHEN id = ${u.id} THEN ${toDbDecimal(u.costPrice)}::numeric`);

      const unitPriceCase = sql`CASE ${sql.join(unitPriceSqlChunks, sql` `)} ELSE unit_price END`;
      const costPriceCase =
        costPriceSqlChunks.length > 0
          ? sql`CASE ${sql.join(costPriceSqlChunks, sql` `)} ELSE cost_price END`
          : undefined;

      await tx
        .update(inventoryItems)
        .set({
          unitPrice: unitPriceCase,
          ...(costPriceCase !== undefined ? { costPrice: costPriceCase } : {}),
          updatedAt: new Date(),
        })
        .where(inArray(inventoryItems.id, ids));
    });
    await deleteCacheValue("inventory:categories");

    revalidateTag("inventory:list", "max");
    revalidatePath("/inventory");
    return successResponse(null);
  } catch (error) {
    return handleActionError(error, "bulkUpdatePrices", "Failed to bulk update prices");
  }
}

const getCachedInventoryCategories = unstable_cache(
  async (): Promise<{ category: string; count: number }[]> => {
    return db
      .select({
        category: inventoryItems.category,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(inventoryItems)
      .where(eq(inventoryItems.isActive, true))
      .groupBy(inventoryItems.category);
  },
  ["inventory:categories-list"],
  { tags: ["inventory:list"], revalidate: 600 },
);

export async function getInventoryCategories(): Promise<
  ActionResponse<{ category: string; count: number }[]>
> {
  try {
    await requireAuth();
    const results = await getCachedInventoryCategories();
    return successResponse(results);
  } catch (error) {
    return handleActionError(error, "getInventoryCategories", "Failed to fetch categories");
  }
}
