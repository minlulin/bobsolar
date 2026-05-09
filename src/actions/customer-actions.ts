'use server';

import { db } from '@/lib/db';
import { customers, type Customer } from '@/lib/db/schema';
import {
  createCustomerSchema,
  updateCustomerSchema,
  type CustomerFilter,
} from '@/lib/validators/customer';
import { requireAuth, requireAdmin } from '@/lib/auth/validate';
import { eq, ilike, or, desc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { ActionResponse } from './inventory-actions'; // Reusing the ActionResponse type

export async function getCustomers(
  filters: CustomerFilter = {},
): Promise<ActionResponse<{ items: Customer[]; total: number }>> {
  try {
    await requireAuth();

    const { search } = filters;

    const where = search
      ? or(
          ilike(customers.name, `%${search}%`),
          ilike(customers.phone, `%${search}%`),
          ilike(customers.email, `%${search}%`),
        )
      : undefined;

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

    const item = await db.query.customers.findFirst({
      where: eq(customers.id, id),
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

    const validated = updateCustomerSchema.parse({
      ...(raw as Record<string, unknown>),
      id,
    });

    const [item] = await db
      .update(customers)
      .set({
        ...validated,
        email: validated.email || null,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, id))
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

    // Check if customer has any linked quotations/projects (optional, but good practice)
    // For now, we'll just allow deletion if the user is admin.

    await db.delete(customers).where(eq(customers.id, id));

    revalidatePath('/customers');
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: 'Failed to delete customer' };
  }
}

export async function searchCustomers(
  query: string,
): Promise<ActionResponse<Customer[]>> {
  try {
    await requireAuth();

    const items = await db.query.customers.findMany({
      where: or(
        ilike(customers.name, `%${query}%`),
        ilike(customers.phone, `%${query}%`),
      ),
      limit: 10,
    });

    return { success: true, data: items };
  } catch {
    return { success: false, error: 'Failed to search customers' };
  }
}
