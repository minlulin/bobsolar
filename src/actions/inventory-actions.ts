'use server';

import { db } from '@/lib/db';
import { inventoryItems, type InventoryItem } from '@/lib/db/schema';
import {
  createInventoryItemSchema,
  updateInventoryItemPayloadSchema,
  inventoryFilterSchema,
} from '@/lib/validators/inventory';
import { requireAuth } from '@/lib/auth/validate';
import { eq, and, ilike, or, asc, sql, count } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { ActionResponse } from '@/lib/utils/action-response';
import { uuidSchema } from '@/lib/validators/common';

export async function getInventoryItems(
  rawFilters: unknown = {},
): Promise<ActionResponse<{ items: InventoryItem[]; total: number }>> {
  try {
    await requireAuth();

    const filters = inventoryFilterSchema.parse(rawFilters);
    const { category, search, isActive = true, page, limit } = filters;
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

    const totals = await db
      .select({ total: count() })
      .from(inventoryItems)
      .where(where);
    const total = totals[0]?.total ?? 0;

    return { success: true, data: { items, total } };
  } catch {
    return { success: false, error: 'Failed to fetch inventory items' };
  }
}

export async function getInventoryItem(
  id: string,
): Promise<ActionResponse<InventoryItem>> {
  try {
    await requireAuth();
    const validatedId = uuidSchema.parse(id);

    const item = await db.query.inventoryItems.findFirst({
      where: eq(inventoryItems.id, validatedId),
    });

    if (!item) {
      return { success: false, error: 'Item not found' };
    }

    return { success: true, data: item };
  } catch {
    return { success: false, error: 'Failed to fetch inventory item' };
  }
}

export async function createInventoryItem(
  raw: unknown,
): Promise<ActionResponse<InventoryItem>> {
  try {
    await requireAuth();

    const validated = createInventoryItemSchema.parse(raw);

    const [item] = await db
      .insert(inventoryItems)
      .values({
        ...validated,
        unitPrice: validated.unitPrice.toString(),
      })
      .returning();

    if (!item) {
      return { success: false, error: 'Failed to create inventory item' };
    }

    revalidatePath('/inventory');
    return { success: true, data: item };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || 'Validation failed',
      };
    }
    return { success: false, error: 'Failed to create inventory item' };
  }
}

export async function updateInventoryItem(
  id: string,
  raw: unknown,
): Promise<ActionResponse<InventoryItem>> {
  try {
    await requireAuth();
    const validatedId = uuidSchema.parse(id);

    const validated = updateInventoryItemPayloadSchema.parse({
      ...(typeof raw === 'object' && raw !== null ? raw : {}),
      id: validatedId,
    });

    const { id: parsedId, ...updateData } = validated;
    void parsedId;

    const [item] = await db
      .update(inventoryItems)
      .set({
        ...updateData,
        unitPrice: updateData.unitPrice
          ? updateData.unitPrice.toString()
          : undefined,
        updatedAt: new Date(),
      })
      .where(eq(inventoryItems.id, validatedId))
      .returning();

    if (!item) {
      return { success: false, error: 'Item not found or failed to update' };
    }

    revalidatePath('/inventory');
    return { success: true, data: item };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || 'Validation failed',
      };
    }
    return { success: false, error: 'Failed to update inventory item' };
  }
}

export async function deleteInventoryItem(
  id: string,
): Promise<ActionResponse<void>> {
  try {
    await requireAuth();
    const validatedId = uuidSchema.parse(id);

    await db
      .update(inventoryItems)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(inventoryItems.id, validatedId));

    revalidatePath('/inventory');
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: 'Failed to delete inventory item' };
  }
}

const bulkUpdateSchema = z.array(
  z.object({
    id: z.uuid(),
    unitPrice: z.number().min(0, 'Unit price must be positive'),
  }),
);

export async function bulkUpdatePrices(
  rawUpdates: unknown,
): Promise<ActionResponse<void>> {
  try {
    await requireAuth();

    const updates = bulkUpdateSchema.parse(rawUpdates);

    await db.transaction(async (tx) => {
      for (const update of updates) {
        await tx
          .update(inventoryItems)
          .set({
            unitPrice: update.unitPrice.toString(),
            updatedAt: new Date(),
          })
          .where(eq(inventoryItems.id, update.id));
      }
    });

    revalidatePath('/inventory');
    return { success: true, data: undefined };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || 'Validation failed',
      };
    }
    return { success: false, error: 'Failed to bulk update prices' };
  }
}

export async function getInventoryCategories(): Promise<
  ActionResponse<{ category: string; count: number }[]>
> {
  try {
    await requireAuth();

    const results = await db
      .select({
        category: inventoryItems.category,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(inventoryItems)
      .where(eq(inventoryItems.isActive, true))
      .groupBy(inventoryItems.category);

    return { success: true, data: results };
  } catch {
    return { success: false, error: 'Failed to fetch categories' };
  }
}
