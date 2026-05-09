'use server';

import { db } from '@/lib/db';
import {
  quotations,
  quotationItems,
  type Quotation,
  type QuotationItem,
  type Customer,
} from '@/lib/db/schema';
import {
  createQuotationSchema,
  type QuotationFilter,
} from '@/lib/validators/quotation';
import { requireAuth, requireAdmin } from '@/lib/auth/validate';
import { eq, and, ilike, desc, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { ActionResponse } from './inventory-actions';
import {
  calculateQuotation,
  calculateLineItem,
  LineItem,
} from '@/lib/pricing/engine';
import { formatQuoteNumber, extractSequence } from '@/lib/utils/quote-number';
import {
  updateQuotationSchema,
  canTransitionStatus,
  type QuotationStatus,
} from '@/lib/validators/quotation';
import {
  handleActionError,
  handleNotFoundError,
  handleStateError,
} from '@/lib/utils/error';

export type QuotationWithCustomer = Quotation & {
  customer: {
    name: string;
  };
};

export async function getQuotations(
  filters: QuotationFilter = {},
): Promise<ActionResponse<{ items: QuotationWithCustomer[]; total: number }>> {
  try {
    await requireAuth();

    const { status, customerId, search } = filters;

    const items = await db.query.quotations.findMany({
      where: and(
        status ? eq(quotations.status, status) : undefined,
        customerId ? eq(quotations.customerId, customerId) : undefined,
        search ? ilike(quotations.quoteNumber, `%${search}%`) : undefined,
      ),
      with: {
        customer: {
          columns: {
            name: true,
          },
        },
      },
      orderBy: [desc(quotations.createdAt)],
    });

    return {
      success: true,
      data: { items: items as QuotationWithCustomer[], total: items.length },
    };
  } catch (error) {
    return handleActionError(
      error,
      'getQuotations',
      'Failed to fetch quotations',
    );
  }
}

export async function getQuotation(
  id: string,
): Promise<
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

    const item = await db.query.quotations.findFirst({
      where: eq(quotations.id, id),
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
      return handleNotFoundError('Quotation', id);
    }

    return {
      success: true,
      data: item as Quotation & {
        items: QuotationItem[];
        customer: Customer;
        project: { id: string; projectNumber: string } | null;
      },
    };
  } catch (error) {
    return handleActionError(
      error,
      'getQuotation',
      'Failed to fetch quotation',
    );
  }
}

export async function createQuotation(
  raw: unknown,
): Promise<ActionResponse<Quotation>> {
  try {
    const auth = await requireAuth();

    const validated = createQuotationSchema.parse(raw);

    const lineItems: LineItem[] = validated.items.map((item) => ({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountPercentage: item.discountPercentage,
    }));

    const pricing = calculateQuotation(
      lineItems,
      validated.discountPercent,
      validated.taxPercent,
    );

    const yearStart = new Date(new Date().getFullYear(), 0, 1);
    const lastQuote = await db.query.quotations.findFirst({
      where: and(sql`${quotations.createdAt} >= ${yearStart}`),
      orderBy: [desc(quotations.quoteNumber)],
    });

    let nextSequence = 1;
    if (lastQuote) {
      nextSequence = extractSequence(lastQuote.quoteNumber) + 1;
    }
    const quoteNumber = formatQuoteNumber(nextSequence);

    const result = await db.transaction(async (tx) => {
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
          status: 'draft',
        })
        .returning();

      if (!quote)
        throw new Error('Failed to create quotation record in database');

      const itemsToInsert = validated.items.map((item, index) => ({
        quotationId: quote.id,
        itemId: item.itemId,
        description: item.description,
        quantity: item.quantity.toString(),
        unitPrice: item.unitPrice.toString(),
        totalPrice: calculateLineItem({
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountPercentage: item.discountPercentage,
        }).toString(),
        sortOrder: index,
      }));

      await tx.insert(quotationItems).values(itemsToInsert);

      return quote;
    });

    revalidatePath('/quotations');
    return { success: true, data: result };
  } catch (error) {
    return handleActionError(
      error,
      'createQuotation',
      'Failed to create quotation',
    );
  }
}

export async function updateQuotationStatus(
  id: string,
  status: QuotationStatus,
): Promise<ActionResponse<void>> {
  try {
    await requireAuth();

    const quote = await db.query.quotations.findFirst({
      where: eq(quotations.id, id),
    });

    if (!quote) return handleNotFoundError('Quotation', id);

    if (!canTransitionStatus(quote.status as QuotationStatus, status)) {
      return handleStateError(
        `Cannot change status from "${quote.status}" to "${status}"`,
      );
    }

    await db
      .update(quotations)
      .set({ status, updatedAt: new Date() })
      .where(eq(quotations.id, id));

    revalidatePath('/quotations');
    revalidatePath(`/quotations/${id}`);
    return { success: true, data: undefined };
  } catch (error) {
    return handleActionError(
      error,
      'updateQuotationStatus',
      'Failed to update quotation status',
    );
  }
}

export async function deleteQuotation(
  id: string,
): Promise<ActionResponse<void>> {
  try {
    await requireAdmin();

    const quote = await db.query.quotations.findFirst({
      where: eq(quotations.id, id),
    });

    if (!quote) return handleNotFoundError('Quotation', id);
    if (quote.status !== 'draft') {
      return handleStateError('Only draft quotations can be deleted');
    }

    await db.delete(quotations).where(eq(quotations.id, id));

    revalidatePath('/quotations');
    return { success: true, data: undefined };
  } catch (error) {
    return handleActionError(
      error,
      'deleteQuotation',
      'Failed to delete quotation',
    );
  }
}

export async function updateQuotation(
  id: string,
  raw: unknown,
): Promise<ActionResponse<Quotation>> {
  try {
    await requireAuth();

    const quote = await db.query.quotations.findFirst({
      where: eq(quotations.id, id),
    });

    if (!quote) return handleNotFoundError('Quotation', id);
    if (quote.status !== 'draft') {
      return handleStateError('Only draft quotations can be updated');
    }

    const validated = updateQuotationSchema.parse(raw);

    const lineItems: LineItem[] =
      validated.items?.map((item) => ({
        quantity: item?.quantity || 0,
        unitPrice: item?.unitPrice || 0,
        discountPercentage: item?.discountPercentage || 0,
      })) || [];

    const pricing = calculateQuotation(
      lineItems,
      validated.discountPercent || 0,
      validated.taxPercent || 0,
    );

    await db.transaction(async (tx) => {
      await tx
        .update(quotations)
        .set({
          customerId: validated.customerId,
          subtotal: pricing.subtotal.toString(),
          discountPercent: (validated.discountPercent || 0).toString(),
          discountAmount: pricing.discountAmount.toString(),
          taxPercent: (validated.taxPercent || 0).toString(),
          taxAmount: pricing.taxAmount.toString(),
          total: pricing.total.toString(),
          notes: validated.notes,
          validUntil: validated.validUntil,
          updatedAt: new Date(),
        })
        .where(eq(quotations.id, id));

      if (validated.items) {
        await tx
          .delete(quotationItems)
          .where(eq(quotationItems.quotationId, id));

        const itemsToInsert = validated.items.map((item, index) => ({
          quotationId: id,
          itemId: item.itemId,
          description: item.description,
          quantity: item.quantity.toString(),
          unitPrice: item.unitPrice.toString(),
          totalPrice: calculateLineItem({
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discountPercentage: item.discountPercentage,
          }).toString(),
          sortOrder: index,
        }));

        await tx.insert(quotationItems).values(itemsToInsert);
      }
    });

    revalidatePath('/quotations');
    revalidatePath(`/quotations/${id}`);

    const updated = await db.query.quotations.findFirst({
      where: eq(quotations.id, id),
    });

    if (!updated) return handleNotFoundError('Quotation', id);

    return { success: true, data: updated };
  } catch (error) {
    return handleActionError(
      error,
      'updateQuotation',
      'Failed to update quotation',
    );
  }
}

export async function duplicateQuotation(
  id: string,
): Promise<ActionResponse<Quotation>> {
  try {
    const auth = await requireAuth();

    const original = await db.query.quotations.findFirst({
      where: eq(quotations.id, id),
      with: { items: true },
    });

    if (!original) return handleNotFoundError('Quotation', id);

    const yearStart = new Date(new Date().getFullYear(), 0, 1);
    const lastQuote = await db.query.quotations.findFirst({
      where: and(sql`${quotations.createdAt} >= ${yearStart}`),
      orderBy: [desc(quotations.quoteNumber)],
    });

    let nextSequence = 1;
    if (lastQuote) {
      nextSequence = extractSequence(lastQuote.quoteNumber) + 1;
    }
    const quoteNumber = formatQuoteNumber(nextSequence);

    const result = await db.transaction(async (tx) => {
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
          validUntil: original.validUntil,
          status: 'draft',
        })
        .returning();

      if (!quote)
        throw new Error('Failed to create duplicated quotation in database');

      const itemsToInsert = original.items.map((item, index) => ({
        quotationId: quote.id,
        itemId: item.itemId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        sortOrder: index,
      }));

      await tx.insert(quotationItems).values(itemsToInsert);

      return quote;
    });

    revalidatePath('/quotations');
    return { success: true, data: result };
  } catch (error) {
    return handleActionError(
      error,
      'duplicateQuotation',
      'Failed to duplicate quotation',
    );
  }
}
