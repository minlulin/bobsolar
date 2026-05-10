'use server';

import { db } from '@/lib/db';
import { customers, type Customer } from '@/lib/db/schema';
import {
  createCustomerSchema,
  updateCustomerSchema,
  customerFilterSchema,
  type CustomerFilter,
} from '@/lib/validators/customer';
import { requireAuth, requireAdmin } from '@/lib/auth/validate';
import { eq, ilike, or, desc, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { ActionResponse } from '@/lib/utils/action-response';
import { uuidSchema } from '@/lib/validators/common';

export async function getCustomers(
  rawFilters: unknown = {},
): Promise<ActionResponse<{ items: Customer[]; total: number }>> {
  try {
    await requireAuth();

    const filters = customerFilterSchema.parse(rawFilters);
    const { search } = filters;

    const baseWhere = eq(customers.isArchived, false);
    const searchWhere = search
      ? or(
          ilike(customers.name, `%${search}%`),
          ilike(customers.phone, `%${search}%`),
          ilike(customers.email, `%${search}%`),
        )
      : undefined;

    const where = searchWhere ? and(baseWhere, searchWhere) : baseWhere;

    const items = await db.query.customers.findMany({
      where,
      orderBy: [desc(customers.createdAt)],
    });

    const total = items.length;

    return { success: true, data: { items, total } };
  } catch {
    return { success: false, error: 'Failed to fetch customers' };
  }
}

export async function getCustomer(
  id: string,
): Promise<ActionResponse<Customer>> {
  try {
    await requireAuth();
    const validatedId = uuidSchema.parse(id);

    const item = await db.query.customers.findFirst({
      where: eq(customers.id, validatedId),
    });

    if (!item) {
      return { success: false, error: 'Customer not found' };
    }

    return { success: true, data: item };
  } catch {
    return { success: false, error: 'Failed to fetch customer' };
  }
}

export async function createCustomer(
  raw: unknown,
): Promise<ActionResponse<Customer>> {
  try {
    await requireAuth(); // Any authenticated user can create a customer

    const validated = createCustomerSchema.parse(raw);

    const [item] = await db
      .insert(customers)
      .values({
        ...validated,
        email: validated.email || null,
      })
      .returning();

    if (!item) {
      return { success: false, error: 'Failed to create customer' };
    }

    revalidatePath('/customers');
    return { success: true, data: item };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || 'Validation failed',
      };
    }
    return { success: false, error: 'Failed to create customer' };
  }
}

export async function updateCustomer(
  id: string,
  raw: unknown,
): Promise<ActionResponse<Customer>> {
  try {
    await requireAuth();
    const validatedId = uuidSchema.parse(id);

    const validated = updateCustomerSchema.parse({ ...raw, id: validatedId });

    const { id: parsedId, ...updateData } = validated;
    void parsedId;

    const [item] = await db
      .update(customers)
      .set({
        ...updateData,
        email: updateData.email || null,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, validatedId))
      .returning();

    if (!item) {
      return {
        success: false,
        error: 'Customer not found or failed to update',
      };
    }

    revalidatePath('/customers');
    return { success: true, data: item };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || 'Validation failed',
      };
    }
    return { success: false, error: 'Failed to update customer' };
  }
}

export async function deleteCustomer(
  id: string,
): Promise<ActionResponse<void>> {
  try {
    await requireAdmin(); // Only admin can delete customers
    const validatedId = uuidSchema.parse(id);

    await db.delete(customers).where(eq(customers.id, validatedId));

    revalidatePath('/customers');
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: 'Failed to archive customer' };
  }
}

export async function searchCustomers(
  query: string,
): Promise<ActionResponse<Customer[]>> {
  try {
    await requireAuth();

    const items = await db.query.customers.findMany({
      where: and(
        eq(customers.isArchived, false),
        or(
          ilike(customers.name, `%${query}%`),
          ilike(customers.phone, `%${query}%`),
        ),
      ),
      limit: 10,
    });

    return { success: true, data: items };
  } catch {
    return { success: false, error: 'Failed to search customers' };
  }
}
