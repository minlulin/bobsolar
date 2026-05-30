"use server";

import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requirePurchaseManagementAccess } from "@/lib/auth/validate";
import { db } from "@/lib/db";
import {
  inventoryItems,
  paymentMethods,
  purchaseOrderItems,
  purchaseOrders,
  supplierPayments,
  suppliers,
} from "@/lib/db/schema";
import {
  createBalancedJournalEntry,
  mapPaymentMethodNameToAssetAccount,
} from "@/lib/finance/ledger";
import { errorResponse, successResponse } from "@/lib/utils/action-response";
import { handleActionError } from "@/lib/utils/error";
import { toDbDecimal, uuidSchema } from "@/lib/validators/common";
import { createPurchaseOrderSchema, payPurchaseOrderSchema } from "@/lib/validators/purchase";

export async function getPurchaseOrders() {
  try {
    await requirePurchaseManagementAccess();
    const data = await db.query.purchaseOrders.findMany({
      orderBy: [desc(purchaseOrders.createdAt)],
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

export async function getPurchaseOrderById(id: string) {
  try {
    await requirePurchaseManagementAccess();
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
export async function createPurchaseOrder(raw: unknown) {
  try {
    const user = await requirePurchaseManagementAccess();
    const validated = createPurchaseOrderSchema.parse(raw);
    const data = validated;
    const totalAmount = data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

    const po = await db.transaction(async (tx) => {
      const [newPo] = await tx
        .insert(purchaseOrders)
        .values({
          poNumber: data.poNumber,
          supplierId: data.supplierId,
          totalAmount: toDbDecimal(totalAmount),
          balanceDue: toDbDecimal(totalAmount),
          status: "draft",
          paymentStatus: "unpaid",
          billDate: data.billDate ?? null,
          dueDate: data.dueDate ?? null,
          notes: data.notes,
          createdBy: user.userId,
        })
        .returning();

      if (!newPo) throw new Error("Failed to create PO");

      if (data.items.length > 0) {
        await tx.insert(purchaseOrderItems).values(
          data.items.map((item, index) => ({
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
  } catch (error) {
    return handleActionError(error, "createPurchaseOrder", "Failed to create purchase order");
  }
}

// 2. Receive the PO (Moves to Warehouse Asset, Debits raw_materials, Credits accounts_payable)
export async function receivePurchaseOrder(id: string) {
  try {
    const user = await requirePurchaseManagementAccess();
    const validatedId = uuidSchema.parse(id);

    await db.transaction(async (tx) => {
      const po = await tx.query.purchaseOrders.findFirst({
        where: eq(purchaseOrders.id, validatedId),
        with: { items: true, supplier: true },
      });

      if (!po) throw new Error("PO not found");
      if (po.status !== "draft") throw new Error("PO is not in draft status");

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
      for (const item of po.items) {
        // Lock the inventory row to prevent concurrent stock updates (lost-update race)
        const [invItem] = await tx
          .select({ stockQty: inventoryItems.stockQty })
          .from(inventoryItems)
          .where(eq(inventoryItems.id, item.itemId))
          .for("update");

        if (!invItem) {
          throw new Error(`inventory_item_not_found:${item.itemId}`);
        }

        // H-3: Use Math.floor (truncate toward zero) instead of Math.round.
        // The PO totalAmount was computed from the exact decimal quantity (e.g. 1.5 units).
        // Rounding up would add more stock than the financial liability covers.
        // Integer stock columns enforce whole units; any fractional surplus is intentionally discarded.
        await tx
          .update(inventoryItems)
          .set({ stockQty: invItem.stockQty + Math.floor(Number(item.quantity)) })
          .where(eq(inventoryItems.id, item.itemId));
      }

      // 3. Finance Ledger (Debit raw_materials, Credit accounts_payable)
      const totalAmountRounded = Math.round(Number(po.totalAmount));
      await createBalancedJournalEntry({
        tx,
        entryDate: new Date(),
        memo: `PO Received: ${po.poNumber} from ${po.supplier.name}`,
        sourceType: "supplier_purchase",
        sourceId: po.id,
        createdBy: user.userId,
        lines: [
          { accountCode: "raw_materials", debit: totalAmountRounded, credit: 0 },
          { accountCode: "accounts_payable", debit: 0, credit: totalAmountRounded },
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
    revalidatePath("/finance");
    return successResponse(null);
  } catch (error) {
    return handleActionError(error, "receivePurchaseOrder", "Failed to receive purchase order");
  }
}

// 3. Pay Supplier (Debits accounts_payable, Credits Asset/Cash)
export async function payPurchaseOrder(raw: unknown) {
  try {
    const user = await requirePurchaseManagementAccess();
    const validated = payPurchaseOrderSchema.parse(raw);
    const data = validated;

    await db.transaction(async (tx) => {
      // Lock the PO row to prevent concurrent payment race conditions
      const [po] = await tx
        .select()
        .from(purchaseOrders)
        .where(eq(purchaseOrders.id, data.purchaseOrderId))
        .for("update");

      if (!po) throw new Error("PO not found");
      if (po.status === "draft") throw new Error("Cannot pay a draft PO. Receive it first.");

      const balanceDue = Math.round(Number(po.balanceDue));
      if (data.amount <= 0 || data.amount > balanceDue) {
        throw new Error("Invalid payment amount");
      }

      // 1. Record Payment
      await tx.insert(supplierPayments).values({
        purchaseOrderId: po.id,
        supplierId: po.supplierId,
        amount: data.amount.toString(),
        paymentMethodId: data.paymentMethodId,
        reference: data.reference,
        notes: data.notes,
        createdBy: user.userId,
      });

      // 2. Update PO Balances
      const newPaid = Math.round(Number(po.paidAmount)) + Math.round(data.amount);
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
              Math.round(Number(supplier.totalOwed)) - Math.round(data.amount),
            ).toString(),
          })
          .where(eq(suppliers.id, po.supplierId));
      }

      // 4. Finance Ledger (Debit AP, Credit Payment Method)
      const method = await tx.query.paymentMethods.findFirst({
        where: eq(paymentMethods.id, data.paymentMethodId),
      });

      if (!method) {
        throw new Error("payment_method_not_found");
      }

      const assetAccountCode = mapPaymentMethodNameToAssetAccount(method.name);
      if (!assetAccountCode) {
        throw new Error(`unsupported_payment_method:${method.name}`);
      }

      const paymentAmountRounded = Math.round(Number(data.amount));
      await createBalancedJournalEntry({
        tx,
        entryDate: new Date(),
        memo: `Supplier Payment: ${po.poNumber} via ${method.name}`,
        sourceType: "supplier_payment",
        sourceId: po.id,
        createdBy: user.userId,
        lines: [
          { accountCode: "accounts_payable", debit: paymentAmountRounded, credit: 0 },
          { accountCode: assetAccountCode, debit: 0, credit: paymentAmountRounded },
        ],
      });
    });

    revalidatePath(`/purchases/${data.purchaseOrderId}`);
    revalidatePath("/purchases");
    revalidatePath("/suppliers");
    revalidatePath("/finance");
    return successResponse(null);
  } catch (error) {
    return handleActionError(error, "payPurchaseOrder", "Failed to process payment");
  }
}
