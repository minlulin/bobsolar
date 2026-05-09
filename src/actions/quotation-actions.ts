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
import { z } from 'zod';
import { ActionResponse } from './inventory-actions';
import { calculateQuotation, LineItem } from '@/lib/pricing/engine';
import { formatQuoteNumber, extractSequence } from '@/lib/utils/quote-number';
import { getSessionFromCookie } from '@/lib/auth/session';

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

    // Build filters
    // Note: Drizzle query API makes it easier to join
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
    console.error('getQuotations error:', error);
    return { success: false, error: 'Failed to fetch quotations' };
  }
}

export async function getQuotation(
  id: string,
): Promise<
  ActionResponse<Quotation & { items: QuotationItem[]; customer: Customer }>
> {
  try {
    await requireAuth();

    const item = await db.query.quotations.findFirst({
      where: eq(quotations.id, id),
      with: {
        items: true,
        customer: true,
      },
    });

    if (!item) {
      return { success: false, error: 'Quotation not found' };
    }

    return {
      success: true,
      data: item as Quotation & { items: QuotationItem[]; customer: Customer },
    };
  } catch {
    return { success: false, error: 'Failed to fetch quotation' };
  }
}

export async function createQuotation(
  raw: unknown,
): Promise<ActionResponse<Quotation>> {
  try {
    const session = await getSessionFromCookie();
    if (!session) return { success: false, error: 'Unauthorized' };

    const validated = createQuotationSchema.parse(raw);

    // 1. Calculate pricing
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

    // 2. Generate Quote Number (QT-YYYY-NNNN)
    // We get the max sequence for the current year
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

    // 3. Transactional Insert
    const result = await db.transaction(async (tx) => {
      const [quote] = await tx
        .insert(quotations)
        .values({
          quoteNumber,
          customerId: validated.customerId,
          createdBy: session.userId,
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

      if (!quote) throw new Error('Failed to create quotation');

      // Insert line items
      const itemsToInsert = validated.items.map((item, index) => ({
        quotationId: quote.id,
        itemId: item.itemId,
        description: item.description,
        quantity: item.quantity.toString(),
        unitPrice: item.unitPrice.toString(),
        totalPrice: (
          item.quantity *
          item.unitPrice *
          (1 - (item.discountPercentage || 0) / 100)
        ).toString(),
        sortOrder: index,
      }));

      await tx.insert(quotationItems).values(itemsToInsert);

      return quote;
    });

    revalidatePath('/quotations');
    return { success: true, data: result };
  } catch (error) {
    console.error('createQuotation error:', error);
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || 'Validation failed',
      };
    }
    return { success: false, error: 'Failed to create quotation' };
  }
}

export async function updateQuotationStatus(
  id: string,
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired',
): Promise<ActionResponse<void>> {
  try {
    await requireAuth();

    await db
      .update(quotations)
      .set({ status, updatedAt: new Date() })
      .where(eq(quotations.id, id));

    revalidatePath('/quotations');
    revalidatePath(`/quotations/${id}`);
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: 'Failed to update status' };
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

    if (!quote) return { success: false, error: 'Quotation not found' };
    if (quote.status !== 'draft') {
      return { success: false, error: 'Only draft quotations can be deleted' };
    }

    await db.delete(quotations).where(eq(quotations.id, id));

    revalidatePath('/quotations');
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: 'Failed to delete quotation' };
  }
}
