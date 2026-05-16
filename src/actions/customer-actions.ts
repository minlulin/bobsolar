'use server';

import { db } from '@/lib/db';
import {
  customers,
  type Customer,
  type Quotation,
  type Project,
} from '@/lib/db/schema';
import {
  createCustomerSchema,
  updateCustomerSchema,
  customerFilterSchema,
} from '@/lib/validators/customer';
import { requireAuth } from '@/lib/auth/validate';
import { eq, ilike, or, desc, and, count } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  errorResponse,
  successResponse,
  type ActionResponse,
} from '@/lib/utils/action-response';
import { handleActionError } from '@/lib/utils/error';
import { uuidSchema } from '@/lib/validators/common';

const deleteCustomerInputSchema = z.object({
  id: uuidSchema,
});

type CustomerWithHistory = Customer & {
  quotations: (Quotation & {
    createdBy: { name: string };
  })[];
  projects: (Project & {
    quotation: { quoteNumber: string } | null;
    costs: { amount: string }[];
  })[];
};

export async function getCustomers(
  rawFilters: unknown = {},
): Promise<ActionResponse<{ items: Customer[]; total: number }>> {
  try {
    await requireAuth();

    const filters = customerFilterSchema.parse(rawFilters);
    const { search, page, limit } = filters;
    const offset = (page - 1) * limit;

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
      limit,
      offset,
    });

    const totals = await db
      .select({ total: count() })
      .from(customers)
      .where(where);
    const total = totals[0]?.total ?? 0;

    return successResponse({ items, total });
  } catch (error) {
    return handleActionError(
      error,
      'getCustomers',
      'Failed to fetch customers',
    );
  }
}

export async function getCustomer(
  id: string,
): Promise<ActionResponse<CustomerWithHistory>> {
  try {
    await requireAuth();
    const validatedId = uuidSchema.parse(id);

    const item = await db.query.customers.findFirst({
      where: eq(customers.id, validatedId),
      with: {
        quotations: {
          orderBy: (q, { desc }) => [desc(q.createdAt)],
          with: {
            createdBy: {
              columns: { name: true },
            },
          },
        },
        projects: {
          orderBy: (p, { desc }) => [desc(p.createdAt)],
          with: {
            quotation: {
              columns: { quoteNumber: true },
            },
            costs: {
              columns: { amount: true },
            },
          },
        },
      },
    });

    if (!item) {
      return errorResponse('Customer not found');
    }

    return successResponse(item);
  } catch (error) {
    return handleActionError(error, 'getCustomer', 'Failed to fetch customer');
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
      return errorResponse('Failed to create customer');
    }

    revalidatePath('/customers');
    return successResponse(item);
  } catch (error) {
    return handleActionError(
      error,
      'createCustomer',
      'Failed to create customer',
    );
  }
}

export async function updateCustomer(
  id: string,
  raw: unknown,
): Promise<ActionResponse<Customer>> {
  try {
    await requireAuth();
    const validatedId = uuidSchema.parse(id);

    const validated = updateCustomerSchema.parse({
      ...(typeof raw === 'object' && raw !== null ? raw : {}),
      id: validatedId,
    });

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
      return errorResponse('Customer not found or failed to update');
    }

    revalidatePath('/customers');
    return successResponse(item);
  } catch (error) {
    return handleActionError(
      error,
      'updateCustomer',
      'Failed to update customer',
    );
  }
}

export async function deleteCustomer(
  id: string,
): Promise<ActionResponse<null>> {
  try {
    await requireAuth();
    const { id: validatedId } = deleteCustomerInputSchema.parse({ id });

    await db
      .update(customers)
      .set({
        isArchived: true,
        archivedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(customers.id, validatedId));

    revalidatePath('/customers');
    return successResponse(null);
  } catch (error) {
    return handleActionError(
      error,
      'deleteCustomer',
      'Failed to archive customer',
    );
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

    return successResponse(items);
  } catch (error) {
    return handleActionError(
      error,
      'searchCustomers',
      'Failed to search customers',
    );
  }
}
