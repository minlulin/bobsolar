"use server";

import { desc, eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { requireOwner } from "@/lib/auth/validate";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import type {
  InventoryItem,
  PaymentMethod,
  PurchaseOrder,
  PurchaseOrderItem,
  Supplier,
  SupplierPayment,
} from "@/lib/db/schema";
import {
  inventoryItems,
  paymentMethods,
  purchaseOrderItems,
  purchaseOrders,
  supplierPayments,
  suppliers,
} from "@/lib/db/schema";
import type { LedgerAccountCode } from "@/lib/domain/finance";
import { invalidateFinanceCacheForWrite } from "@/lib/finance/cache-invalidation";
import {
  createBalancedJournalEntry,
  mapPaymentMethodNameToAssetAccount,
} from "@/lib/finance/ledger";
import { type ActionResponse, errorResponse, successResponse } from "@/lib/utils/action-response";
import { handleActionError } from "@/lib/utils/error";
import { withIdempotency } from "@/lib/utils/idempotency";
import { toDbDecimal, uuidSchema } from "@/lib/validators/common";
import {
  createPurchaseOrderSchema,
  payPurchaseOrderSchema,
  receivePartialPurchaseOrderSchema,
} from "@/lib/validators/purchase";

export async function getPurchaseOrders(): Promise<
  ActionResponse<
    Array<
      PurchaseOrder & {
        supplier: Supplier;
        items: PurchaseOrderItem[];
        payments: SupplierPayment[];
      }
    >
  >
> {
  try {
    await requireOwner();
    const data = await db.query.purchaseOrders.findMany({
      orderBy: [desc(purchaseOrders.createdAt)],
      limit: 200,
      with: {
        supplier: true,
        items: true,
        payments: true,
      },
    });
    return successResponse(data);
  } catch (error) {
    return handleActionError(error, "getPurchaseOrders", "Failed to fetch purchase orders");
  }
}

export async function getPurchaseOrderById(id: string): Promise<
  ActionResponse<
    PurchaseOrder & {
      supplier: Supplier;
      items: (PurchaseOrderItem & { item: InventoryItem })[];
      payments: (SupplierPayment & { paymentMethod: PaymentMethod })[];
    }
  >
> {
  try {
    await requireOwner();
    const validatedId = uuidSchema.parse(id);
    const data = await db.query.purchaseOrders.findFirst({
      where: eq(purchaseOrders.id, validatedId),
      with: {
        supplier: true,
        items: {
          with: {
            item: true,
          },
        },
        payments: {
          with: {
            paymentMethod: true,
          },
        },
      },
    });
    if (!data) return errorResponse("Purchase order not found");
    return successResponse(data);
  } catch (error) {
    return handleActionError(error, "getPurchaseOrderById", "Failed to fetch purchase order");
  }
}

// 1. Create a Draft PO (Warehouse Inbound from Catalog)
export async function createPurchaseOrder(raw: unknown): Promise<ActionResponse<PurchaseOrder>> {
  try {
    const user = await requireOwner();
    const validated = createPurchaseOrderSchema.parse(raw);
    const totalAmount = validated.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );

    return await withIdempotency("createPurchaseOrder", user.userId, validated, async () => {
      const po = await db.transaction(async (tx) => {
        const [newPo] = await tx
          .insert(purchaseOrders)
          .values({
            poNumber: validated.poNumber,
            supplierId: validated.supplierId,
            totalAmount: toDbDecimal(totalAmount),
            balanceDue: toDbDecimal(totalAmount),
            status: "draft",
            paymentStatus: "unpaid",
            billDate: validated.billDate ?? null,
            dueDate: validated.dueDate ?? null,
            notes: validated.notes,
            createdBy: user.userId,
          })
          .returning();

        if (!newPo) throw new Error("Failed to create PO");

        if (validated.items.length > 0) {
          await tx.insert(purchaseOrderItems).values(
            validated.items.map((item, index) => ({
              purchaseOrderId: newPo.id,
              itemId: item.itemId,
              description: item.description,
              quantity: toDbDecimal(item.quantity),
              unitPrice: toDbDecimal(item.unitPrice),
              totalPrice: toDbDecimal(item.quantity * item.unitPrice),
              sortOrder: index,
            })),
          );
        }

        return newPo;
      });

      revalidatePath("/purchases");
      return successResponse(po);
    });
  } catch (error) {
    return handleActionError(error, "createPurchaseOrder", "Failed to create purchase order");
  }
}

// 2. Receive the PO (Moves to Warehouse Asset, Debits raw_materials, Credits accounts_payable)
export async function receivePurchaseOrder(id: string): Promise<ActionResponse<null>> {
  try {
    const user = await requireOwner();
    const validatedId = uuidSchema.parse(id);

    await db.transaction(async (tx) => {
      const [po] = await tx
        .select()
        .from(purchaseOrders)
        .where(eq(purchaseOrders.id, validatedId))
        .for("update");

      if (!po) throw new Error("PO not found");
      if (po.status !== "draft") throw new Error("PO is not in draft status");

      const poWithItems = await tx.query.purchaseOrders.findFirst({
        where: eq(purchaseOrders.id, validatedId),
        with: { items: true, supplier: true },
      });
      if (!poWithItems) throw new Error("PO not found");

      // 1. Update PO Status
      await tx
        .update(purchaseOrders)
        .set({
          status: "received",
          receivedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(purchaseOrders.id, validatedId));

      // 2. Increase Warehouse Stock in Catalog (Item Master)
      for (const item of poWithItems.items) {
        const [invItem] = await tx
          .select({ stockQty: inventoryItems.stockQty })
          .from(inventoryItems)
          .where(eq(inventoryItems.id, item.itemId))
          .for("update");

        if (!invItem) {
          throw new Error(`inventory_item_not_found:${item.itemId}`);
        }

        await tx
          .update(inventoryItems)
          .set({ stockQty: invItem.stockQty + Number(item.quantity) })
          .where(eq(inventoryItems.id, item.itemId));
      }

      // 3. Finance Ledger (Debit raw_materials, Credit accounts_payable)
      const totalAmountRounded = Math.round(Number(po.totalAmount));
      await createBalancedJournalEntry({
        tx,
        entryDate: new Date(),
        memo: `PO Received: ${po.poNumber} from ${poWithItems.supplier.name}`,
        sourceType: "supplier_purchase",
        sourceId: po.id,
        createdBy: user.userId,
        lines: [
          {
            accountCode: "raw_materials" as LedgerAccountCode,
            debit: totalAmountRounded,
            credit: 0,
          },
          {
            accountCode: "accounts_payable" as LedgerAccountCode,
            debit: 0,
            credit: totalAmountRounded,
          },
        ],
      });

      // Update Supplier Total Owed
      const [supplier] = await tx
        .select()
        .from(suppliers)
        .where(eq(suppliers.id, po.supplierId))
        .for("update");
      if (supplier) {
        await tx
          .update(suppliers)
          .set({
            totalOwed: (
              Math.round(Number(supplier.totalOwed)) + Math.round(Number(po.totalAmount))
            ).toString(),
          })
          .where(eq(suppliers.id, po.supplierId));
      }
    });

    revalidatePath(`/purchases/${validatedId}`);
    revalidatePath("/purchases");
    revalidatePath("/suppliers");
    revalidatePath("/inventory");
    revalidateTag(CACHE_TAGS.INVENTORY_LIST, "max");
    await invalidateFinanceCacheForWrite();
    return successResponse(null);
  } catch (error) {
    return handleActionError(error, "receivePurchaseOrder", "Failed to receive purchase order");
  }
}

// 2b. Receive Partial PO (incremental stock + per-line receivedQuantity tracking)
export async function receivePartialPurchaseOrder(
  raw: unknown,
): Promise<ActionResponse<{ status: string; fullyReceived: boolean }>> {
  try {
    const user = await requireOwner();
    const validated = receivePartialPurchaseOrderSchema.parse(raw);

    const result = await db.transaction(async (tx) => {
      // Lock the PO row to prevent concurrent receipt race conditions
      const [po] = await tx
        .select()
        .from(purchaseOrders)
        .where(eq(purchaseOrders.id, validated.purchaseOrderId))
        .for("update");

      if (!po) throw new Error("PO not found");
      if (po.status !== "draft") throw new Error("PO is not in draft status");

      // Fetch PO with items and supplier for journal entry
      const poWithItems = await tx.query.purchaseOrders.findFirst({
        where: eq(purchaseOrders.id, validated.purchaseOrderId),
        with: { items: true, supplier: true },
      });
      if (!poWithItems) throw new Error("PO not found");

      let totalReceivedValue = 0;

      // Process each line item
      for (const receiveItem of validated.items) {
        const lineItem = poWithItems.items.find((li) => li.id === receiveItem.lineItemId);
        if (!lineItem) throw new Error(`Line item not found: ${receiveItem.lineItemId}`);

        const currentReceived = Number(lineItem.receivedQuantity);
        const orderedQty = Number(lineItem.quantity);
        const newReceived = currentReceived + receiveItem.quantity;

        // Validate: received + new <= ordered
        if (newReceived > orderedQty) {
          throw new Error(
            `Over-reception: line item ${lineItem.description} — received (${currentReceived}) + new (${receiveItem.quantity}) exceeds ordered (${orderedQty})`,
          );
        }

        // Update receivedQuantity on the line item
        await tx
          .update(purchaseOrderItems)
          .set({ receivedQuantity: newReceived.toString() })
          .where(eq(purchaseOrderItems.id, receiveItem.lineItemId));

        // Increment inventory stock
        const [invItem] = await tx
          .select({ stockQty: inventoryItems.stockQty })
          .from(inventoryItems)
          .where(eq(inventoryItems.id, lineItem.itemId))
          .for("update");

        if (!invItem) {
          throw new Error(`inventory_item_not_found:${lineItem.itemId}`);
        }

        await tx
          .update(inventoryItems)
          .set({ stockQty: invItem.stockQty + Math.round(receiveItem.quantity) })
          .where(eq(inventoryItems.id, lineItem.itemId));

        // Accumulate value for journal entry (quantity * unitPrice)
        totalReceivedValue += Math.round(receiveItem.quantity * Number(lineItem.unitPrice));
      }

      // Check if all lines are now fully received
      const updatedItems = await tx
        .select({
          quantity: purchaseOrderItems.quantity,
          receivedQuantity: purchaseOrderItems.receivedQuantity,
        })
        .from(purchaseOrderItems)
        .where(eq(purchaseOrderItems.purchaseOrderId, validated.purchaseOrderId));

      const allFullyReceived = updatedItems.every(
        (item) => Number(item.receivedQuantity) >= Number(item.quantity),
      );

      if (allFullyReceived) {
        // Set PO to received
        await tx
          .update(purchaseOrders)
          .set({
            status: "received",
            receivedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(purchaseOrders.id, validated.purchaseOrderId));
      }
      // If partially received, keep status as "draft" (no status change needed)

      // Create journal entry for the received portion only
      if (totalReceivedValue > 0) {
        await createBalancedJournalEntry({
          tx,
          entryDate: new Date(),
          memo: `Partial PO Received: ${po.poNumber} from ${poWithItems.supplier.name}`,
          sourceType: "supplier_purchase",
          sourceId: po.id,
          createdBy: user.userId,
          lines: [
            {
              accountCode: "raw_materials" as LedgerAccountCode,
              debit: totalReceivedValue,
              credit: 0,
            },
            {
              accountCode: "accounts_payable" as LedgerAccountCode,
              debit: 0,
              credit: totalReceivedValue,
            },
          ],
        });

        // Update Supplier Total Owed
        const [supplier] = await tx
          .select()
          .from(suppliers)
          .where(eq(suppliers.id, po.supplierId))
          .for("update");
        if (supplier) {
          await tx
            .update(suppliers)
            .set({
              totalOwed: (Math.round(Number(supplier.totalOwed)) + totalReceivedValue).toString(),
            })
            .where(eq(suppliers.id, po.supplierId));
        }
      }

      return {
        status: allFullyReceived ? "received" : "draft",
        fullyReceived: allFullyReceived,
      };
    });

    revalidatePath(`/purchases/${validated.purchaseOrderId}`);
    revalidatePath("/purchases");
    revalidatePath("/suppliers");
    revalidatePath("/inventory");
    revalidateTag(CACHE_TAGS.INVENTORY_LIST, "max");
    await invalidateFinanceCacheForWrite();
    return successResponse(result);
  } catch (error) {
    return handleActionError(
      error,
      "receivePartialPurchaseOrder",
      "Failed to receive partial purchase order",
    );
  }
}

// 3. Pay Supplier (Debits accounts_payable, Credits Asset/Cash)
export async function payPurchaseOrder(raw: unknown): Promise<ActionResponse<null>> {
  try {
    const user = await requireOwner();
    const validated = payPurchaseOrderSchema.parse(raw);

    return await withIdempotency("payPurchaseOrder", user.userId, validated, async () => {
      await db.transaction(async (tx) => {
        // Lock the PO row to prevent concurrent payment race conditions
        const [po] = await tx
          .select()
          .from(purchaseOrders)
          .where(eq(purchaseOrders.id, validated.purchaseOrderId))
          .for("update");

        if (!po) throw new Error("PO not found");
        if (po.status === "draft") throw new Error("Cannot pay a draft PO. Receive it first.");

        const balanceDue = Math.round(Number(po.balanceDue));
        if (validated.amount <= 0 || validated.amount > balanceDue) {
          throw new Error("Invalid payment amount");
        }

        // 1. Record Payment
        const [payment] = await tx
          .insert(supplierPayments)
          .values({
            purchaseOrderId: po.id,
            supplierId: po.supplierId,
            amount: validated.amount.toString(),
            paymentMethodId: validated.paymentMethodId,
            reference: validated.reference,
            notes: validated.notes,
            createdBy: user.userId,
          })
          .returning({ id: supplierPayments.id });

        if (!payment) throw new Error("Failed to create supplier payment");

        // 2. Update PO Balances
        const newPaid = Math.round(Number(po.paidAmount)) + Math.round(validated.amount);
        const newBalance = Math.round(Number(po.totalAmount)) - newPaid;
        const newPaymentStatus = newBalance <= 0 ? "paid" : "partial";

        await tx
          .update(purchaseOrders)
          .set({
            paidAmount: newPaid.toString(),
            balanceDue: newBalance.toString(),
            paymentStatus: newPaymentStatus,
            updatedAt: new Date(),
          })
          .where(eq(purchaseOrders.id, po.id));

        // 3. Update Supplier Total Owed
        const [supplier] = await tx
          .select()
          .from(suppliers)
          .where(eq(suppliers.id, po.supplierId))
          .for("update");
        if (supplier) {
          await tx
            .update(suppliers)
            .set({
              totalOwed: Math.max(
                0,
                Math.round(Number(supplier.totalOwed)) - Math.round(validated.amount),
              ).toString(),
            })
            .where(eq(suppliers.id, po.supplierId));
        }

        // 4. Finance Ledger (Debit AP, Credit Payment Method)
        const method = await tx.query.paymentMethods.findFirst({
          where: eq(paymentMethods.id, validated.paymentMethodId),
        });

        if (!method) {
          throw new Error("payment_method_not_found");
        }

        const assetAccountCode = mapPaymentMethodNameToAssetAccount(method.name);
        if (!assetAccountCode) {
          throw new Error(`unsupported_payment_method:${method.name}`);
        }

        const paymentAmountRounded = Math.round(Number(validated.amount));
        await createBalancedJournalEntry({
          tx,
          entryDate: new Date(),
          memo: `Supplier Payment: ${po.poNumber} via ${method.name}`,
          sourceType: "supplier_payment",
          sourceId: payment.id,
          createdBy: user.userId,
          lines: [
            {
              accountCode: "accounts_payable" as LedgerAccountCode,
              debit: paymentAmountRounded,
              credit: 0,
            },
            { accountCode: assetAccountCode, debit: 0, credit: paymentAmountRounded },
          ],
        });
      });

      revalidatePath(`/purchases/${validated.purchaseOrderId}`);
      revalidatePath("/purchases");
      revalidatePath("/suppliers");
      await invalidateFinanceCacheForWrite();
      return successResponse(null);
    });
  } catch (error) {
    return handleActionError(error, "payPurchaseOrder", "Failed to process payment");
  }
}
