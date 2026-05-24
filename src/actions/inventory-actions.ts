"use server";

import { and, asc, count, eq, ilike, or, sql } from "drizzle-orm";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { z } from "zod";
import { requireAdmin, requireAuth } from "@/lib/auth/validate";
import { deleteCacheValue } from "@/lib/cache";
import { db } from "@/lib/db";
import { type InventoryItem, inventoryItems } from "@/lib/db/schema";
import { type ActionResponse, errorResponse, successResponse } from "@/lib/utils/action-response";
import { handleActionError } from "@/lib/utils/error";
import { uuidSchema } from "@/lib/validators/common";
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
    const where = and(
      isActive !== null ? eq(inventoryItems.isActive, isActive) : undefined,
      category ? eq(inventoryItems.category, category) : undefined,
      search
        ? or(
            ilike(inventoryItems.name, `%${search}%`),
            ilike(inventoryItems.brand, `%${search}%`),
            ilike(inventoryItems.modelNumber, `%${search}%`),
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
    await requireAdmin();

    const validated = createInventoryItemSchema.parse(raw);

    let brand = validated.brand;
    let modelNumber = validated.modelNumber;
    if (
      ["panel", "inverter", "battery"].includes(validated.category) &&
      validated.specifications &&
      typeof validated.specifications === "object"
    ) {
      const specs = validated.specifications as Record<string, unknown>;
      if (typeof specs["brandModel"] === "string") {
        const brandModel = specs["brandModel"].trim();
        const parts = brandModel.split(/\s+/);
        brand = parts[0] || "";
        modelNumber = parts.slice(1).join(" ") || "";
      }
    }

    const [item] = await db
      .insert(inventoryItems)
      .values({
        ...validated,
        brand: brand || null,
        modelNumber: modelNumber || null,
        costPrice: validated.costPrice.toFixed(2),
        unitPrice: validated.unitPrice.toFixed(2),
      })
      .returning();

    if (!item) {
      return errorResponse("Failed to create inventory item");
    }
    await deleteCacheValue("inventory:categories");

    revalidateTag("inventory:list", "default");
    revalidatePath("/inventory");
    return successResponse(item);
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

    let brand = updateData.brand;
    let modelNumber = updateData.modelNumber;
    if (
      updateData.category &&
      ["panel", "inverter", "battery"].includes(updateData.category) &&
      updateData.specifications &&
      typeof updateData.specifications === "object"
    ) {
      const specs = updateData.specifications as Record<string, unknown>;
      if (typeof specs["brandModel"] === "string") {
        const brandModel = specs["brandModel"].trim();
        const parts = brandModel.split(/\s+/);
        brand = parts[0] || "";
        modelNumber = parts.slice(1).join(" ") || "";
      }
    }

    const [item] = await db
      .update(inventoryItems)
      .set({
        ...updateData,
        ...(brand !== undefined ? { brand: brand || null } : {}),
        ...(modelNumber !== undefined ? { modelNumber: modelNumber || null } : {}),
        costPrice: updateData.costPrice !== undefined ? updateData.costPrice.toFixed(2) : undefined,
        unitPrice: updateData.unitPrice !== undefined ? updateData.unitPrice.toFixed(2) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(inventoryItems.id, validatedId))
      .returning();

    if (!item) {
      return errorResponse("Item not found or failed to update");
    }
    await deleteCacheValue("inventory:categories");

    revalidateTag("inventory:list", "default");
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

    revalidateTag("inventory:list", "default");
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

    await db.transaction(async (tx) => {
      for (const update of updates) {
        await tx
          .update(inventoryItems)
          .set({
            costPrice: update.costPrice !== undefined ? update.costPrice.toFixed(2) : undefined,
            unitPrice: update.unitPrice.toFixed(2),
            updatedAt: new Date(),
          })
          .where(eq(inventoryItems.id, update.id));
      }
    });
    await deleteCacheValue("inventory:categories");

    revalidateTag("inventory:list", "default");
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
