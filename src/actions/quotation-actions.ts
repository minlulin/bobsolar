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
import { eq, and, ilike, desc, sql, lt } from 'drizzle-orm';
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
  createdBy: {
    name: string;
  };
};

export async function getQuotations(
  filters: QuotationFilter = {},
): Promise<ActionResponse<{ items: QuotationWithCustomer[]; total: number }>> {
  try {
    await requireAuth();

    const { status, customerId, search } = filters;

    // Auto-expire sent quotes that have passed their validUntil date
    await db
      .update(quotations)
      .set({ status: 'expired' })
      .where(
        and(
          eq(quotations.status, 'sent'),
          lt(quotations.validUntil, new Date())
        )
      );

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
        createdBy: {
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

export async function getQuotation(id: string): Promise<
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

    // Auto-expire if applicable
    await db
      .update(quotations)
      .set({ status: 'expired' })
      .where(
        and(
          eq(quotations.id, id),
          eq(quotations.status, 'sent'),
          lt(quotations.validUntil, new Date())
        )
      );

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

    let retries = 3;
    while (retries > 0) {
      try {
        const yearStart = new Date(new Date().getFullYear(), 0, 1);
        const lastQuote = await db.query.quotations.findFirst({
          where: and(sql`${quotations.createdAt} >= ${yearStart}`),
          orderBy: [desc(quotations.createdAt)],
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
            discountPercentage: item.discountPercentage.toString(),
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
      } catch (error: any) {
        if (error.code === '23505' && retries > 1) {
          retries--;
          continue;
        }
        throw error;
      }
    }
    
    return handleStateError('Failed to generate unique quote number after retries.');
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
      with: { items: true },
    });

    if (!quote) return handleNotFoundError('Quotation', id);
    if (quote.status !== 'draft') {
      return handleStateError('Only draft quotations can be updated');
    }

    const validated = updateQuotationSchema.parse(raw);

    const patch: Partial<typeof quotations.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (validated.customerId !== undefined) patch.customerId = validated.customerId;
    if (validated.notes !== undefined) patch.notes = validated.notes;
    if (validated.validUntil !== undefined) patch.validUntil = validated.validUntil;

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
      const lineItems: LineItem[] = validated.items
        ? validated.items.map((item) => ({
            quantity: item.quantity || 0,
            unitPrice: item.unitPrice || 0,
            discountPercentage: item.discountPercentage || 0,
          }))
        : quote.items.map((item) => ({
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            discountPercentage: Number(item.discountPercentage || 0),
          }));

      const dPct =
        validated.discountPercent !== undefined
          ? validated.discountPercent
          : Number(quote.discountPercent);
      const tPct =
        validated.taxPercent !== undefined
          ? validated.taxPercent
          : Number(quote.taxPercent);

      const pricing = calculateQuotation(lineItems, dPct, tPct);

      patch.subtotal = pricing.subtotal.toString();
      patch.discountAmount = pricing.discountAmount.toString();
      patch.taxAmount = pricing.taxAmount.toString();
      patch.total = pricing.total.toString();
    }

    await db.transaction(async (tx) => {
      if (Object.keys(patch).length > 0) {
        await tx.update(quotations).set(patch).where(eq(quotations.id, id));
      }

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
          discountPercentage: item.discountPercentage.toString(),
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

    let retries = 3;
    while (retries > 0) {
      try {
        const yearStart = new Date(new Date().getFullYear(), 0, 1);
        const lastQuote = await db.query.quotations.findFirst({
          where: and(sql`${quotations.createdAt} >= ${yearStart}`),
          orderBy: [desc(quotations.createdAt)],
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
            discountPercentage: item.discountPercentage,
            totalPrice: item.totalPrice,
            sortOrder: index,
          }));

          await tx.insert(quotationItems).values(itemsToInsert);

          return quote;
        });

        revalidatePath('/quotations');
        return { success: true, data: result };
      } catch (error: any) {
        if (error.code === '23505' && retries > 1) {
          retries--;
          continue;
        }
        throw error;
      }
    }
    
    return handleStateError('Failed to duplicate quote after retries.');
  } catch (error) {
    return handleActionError(
      error,
      'duplicateQuotation',
      'Failed to duplicate quotation',
    );
  }
}

export async function deleteQuotation(
  id: string,
): Promise<ActionResponse<void>> {
  try {
    const session = await requireAuth();

    const quotation = await db.query.quotations.findFirst({
      where: eq(quotations.id, id),
    });

    if (!quotation) {
      return handleNotFoundError('Quotation');
    }

    // Only allow deleting drafts
    if (quotation.status !== 'draft') {
      return handleStateError('Only draft quotations can be deleted');
    }

    // Only creator or admin can delete
    if (quotation.createdBy !== session.userId && session.role !== 'admin') {
      return { success: false, error: 'Unauthorized to delete this quotation' };
    }

    await db.delete(quotations).where(eq(quotations.id, id));

    revalidatePath('/quotations');
    revalidatePath('/', 'layout');
    return { success: true, data: undefined };
  } catch (error) {
    return handleActionError(error, 'delete quotation');
  }
}
