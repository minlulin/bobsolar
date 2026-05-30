"use server";

import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireSupplierManagementAccess } from "@/lib/auth/validate";
import { db } from "@/lib/db";
import { type Supplier, suppliers } from "@/lib/db/schema";
import { type ActionResponse, errorResponse, successResponse } from "@/lib/utils/action-response";
import { handleActionError } from "@/lib/utils/error";
import { uuidSchema } from "@/lib/validators/common";
import { createSupplierSchema, updateSupplierSchema } from "@/lib/validators/supplier";

export async function getSuppliers(): Promise<ActionResponse<Supplier[]>> {
  try {
    await requireSupplierManagementAccess();
    const data = await db
      .select()
      .from(suppliers)
      .where(eq(suppliers.isActive, true))
      .orderBy(desc(suppliers.createdAt));
    return successResponse(data);
  } catch (error) {
    return handleActionError(error, "getSuppliers", "Failed to fetch suppliers");
  }
}

export async function getSupplierById(id: string): Promise<ActionResponse<Supplier>> {
  try {
    await requireSupplierManagementAccess();
    const validatedId = uuidSchema.parse(id);
    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, validatedId));
    if (!supplier) {
      return errorResponse("Supplier not found");
    }
    return successResponse(supplier);
  } catch (error) {
    return handleActionError(error, "getSupplierById", "Failed to fetch supplier");
  }
}

export async function createSupplier(raw: unknown): Promise<ActionResponse<Supplier>> {
  try {
    await requireSupplierManagementAccess();
    const validated = createSupplierSchema.parse(raw);

    const [newSupplier] = await db
      .insert(suppliers)
      .values({
        name: validated.name,
        phone: validated.phone,
        email: validated.email,
        address: validated.address,
        companyName: validated.companyName,
        notes: validated.notes,
      })
      .returning();

    if (!newSupplier) {
      return errorResponse("Failed to create supplier");
    }

    revalidatePath("/suppliers");
    return successResponse(newSupplier);
  } catch (error) {
    return handleActionError(error, "createSupplier", "Failed to create supplier");
  }
}

export async function updateSupplier(id: string, raw: unknown): Promise<ActionResponse<Supplier>> {
  try {
    await requireSupplierManagementAccess();
    const validatedId = uuidSchema.parse(id);
    const updateData = updateSupplierSchema.parse(raw);

    const [updatedSupplier] = await db
      .update(suppliers)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(suppliers.id, validatedId))
      .returning();

    if (!updatedSupplier) {
      return errorResponse("Supplier not found or failed to update");
    }

    revalidatePath("/suppliers");
    return successResponse(updatedSupplier);
  } catch (error) {
    return handleActionError(error, "updateSupplier", "Failed to update supplier");
  }
}

export async function deleteSupplier(id: string): Promise<ActionResponse<null>> {
  try {
    await requireSupplierManagementAccess();
    const validatedId = uuidSchema.parse(id);

    const deleted = await db
      .update(suppliers)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(suppliers.id, validatedId))
      .returning();

    if (deleted.length === 0) {
      return errorResponse("Supplier not found");
    }

    revalidatePath("/suppliers");
    return successResponse(null);
  } catch (error) {
    return handleActionError(error, "deleteSupplier", "Failed to delete supplier");
  }
}
