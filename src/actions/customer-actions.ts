"use server";

import { and, count, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/validate";
import { db } from "@/lib/db";
import { type Customer, customers, projects, quotations } from "@/lib/db/schema";
import { type ActionResponse, errorResponse, successResponse } from "@/lib/utils/action-response";
import { handleActionError, handleStateError } from "@/lib/utils/error";
import { withIdempotency } from "@/lib/utils/idempotency";
import { escapeLikePattern } from "@/lib/utils/search";
import { uuidSchema } from "@/lib/validators/common";
import {
  createCustomerSchema,
  customerFilterSchema,
  customerSearchSchema,
  updateCustomerSchema,
} from "@/lib/validators/customer";

const deleteCustomerInputSchema = z.object({
  id: uuidSchema,
});

function _customerWithHistoryQuery(customerId: string) {
  return db.query.customers.findFirst({
    where: eq(customers.id, customerId),
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
}

export type CustomerWithHistory = NonNullable<
  Awaited<ReturnType<typeof _customerWithHistoryQuery>>
>;

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
      ? (() => {
          const escaped = escapeLikePattern(search);
          return or(
            ilike(customers.name, `%${escaped}%`),
            ilike(customers.phone, `%${escaped}%`),
            ilike(customers.email, `%${escaped}%`),
          );
        })()
      : undefined;

    const where = searchWhere ? and(baseWhere, searchWhere) : baseWhere;

    const [items, totals] = await Promise.all([
      db.query.customers.findMany({
        where,
        orderBy: [desc(customers.createdAt)],
        limit,
        offset,
      }),
      db.select({ total: count() }).from(customers).where(where),
    ]);

    const total = totals[0]?.total ?? 0;

    return successResponse({ items, total });
  } catch (error) {
    return handleActionError(error, "getCustomers", "Failed to fetch customers");
  }
}

export async function getCustomer(id: string): Promise<ActionResponse<CustomerWithHistory>> {
  try {
    await requireAuth();
    const validatedId = uuidSchema.parse(id);

    const item = await _customerWithHistoryQuery(validatedId);

    if (!item) {
      return errorResponse("Customer not found");
    }

    return successResponse(item);
  } catch (error) {
    return handleActionError(error, "getCustomer", "Failed to fetch customer");
  }
}

export async function createCustomer(raw: unknown): Promise<ActionResponse<Customer>> {
  try {
    const session = await requireAuth();
    const validated = createCustomerSchema.parse(raw);

    return await withIdempotency("createCustomer", session.userId, validated, async () => {
      const [item] = await db
        .insert(customers)
        .values({
          ...validated,
          email: validated.email || null,
        })
        .returning();

      if (!item) {
        return errorResponse("Failed to create customer");
      }

      revalidatePath("/customers");
      return successResponse(item);
    });
  } catch (error) {
    return handleActionError(error, "createCustomer", "Failed to create customer");
  }
}

export async function updateCustomer(id: string, raw: unknown): Promise<ActionResponse<Customer>> {
  try {
    await requireAuth();
    const validatedId = uuidSchema.parse(id);

    const validated = updateCustomerSchema.parse({
      ...(typeof raw === "object" && raw !== null ? raw : {}),
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
      return errorResponse("Customer not found or failed to update");
    }

    revalidatePath("/customers");
    return successResponse(item);
  } catch (error) {
    return handleActionError(error, "updateCustomer", "Failed to update customer");
  }
}

export async function deleteCustomer(id: string): Promise<ActionResponse<null>> {
  try {
    await requireAuth();
    const { id: validatedId } = deleteCustomerInputSchema.parse({ id });

    const activeProjects = await db.query.projects.findFirst({
      where: and(
        eq(projects.customerId, validatedId),
        inArray(projects.status, ["planning", "in_progress", "on_hold", "installation_completed"]),
      ),
    });
    if (activeProjects) {
      return handleStateError("Cannot archive customer with active projects.");
    }

    const activeQuotes = await db.query.quotations.findFirst({
      where: and(
        eq(quotations.customerId, validatedId),
        inArray(quotations.status, ["draft", "sent", "accepted"]),
      ),
    });
    if (activeQuotes) {
      return handleStateError("Cannot archive customer with active quotations.");
    }

    await db
      .update(customers)
      .set({
        isArchived: true,
        archivedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(customers.id, validatedId));

    revalidatePath("/customers");
    return successResponse(null);
  } catch (error) {
    return handleActionError(error, "deleteCustomer", "Failed to archive customer");
  }
}

export async function searchCustomers(query: string): Promise<ActionResponse<Customer[]>> {
  try {
    await requireAuth();
    const validatedQuery = customerSearchSchema.parse(query);
    const escaped = escapeLikePattern(validatedQuery);

    const items = await db.query.customers.findMany({
      where: and(
        eq(customers.isArchived, false),
        or(ilike(customers.name, `%${escaped}%`), ilike(customers.phone, `%${escaped}%`)),
      ),
      limit: 10,
    });

    return successResponse(items);
  } catch (error) {
    return handleActionError(error, "searchCustomers", "Failed to search customers");
  }
}
