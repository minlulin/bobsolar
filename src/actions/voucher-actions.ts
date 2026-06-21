"use server";

import { desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireAuth } from "@/lib/auth/validate";
import { db } from "@/lib/db";
import { type ProjectVoucher, projects, projectVouchers } from "@/lib/db/schema";
import { type ActionResponse, successResponse } from "@/lib/utils/action-response";
import { AdvisoryLock } from "@/lib/utils/advisory-lock";
import { handleActionError, handleNotFoundError, handleStateError } from "@/lib/utils/error";
import { extractVoucherSequence, formatVoucherNumber } from "@/lib/utils/voucher-number";
import { uuidSchema } from "@/lib/validators/common";
import { generateVoucherSchema } from "@/lib/validators/voucher";

export type VoucherWithProject = ProjectVoucher & {
  projectNumber: string;
  customerName: string;
};

export async function generateVoucher(raw: unknown): Promise<ActionResponse<ProjectVoucher>> {
  try {
    const auth = await requireAdmin();
    const data = generateVoucherSchema.parse(raw);

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, data.projectId),
      with: { customer: { columns: { name: true } } },
    });
    if (!project) return handleNotFoundError("Project", data.projectId);
    if (project.status !== "completed") {
      return handleStateError("Vouchers can only be generated for completed projects.");
    }

    if (data.paidAmount > data.totalAmount) {
      return handleStateError("Paid amount cannot exceed total amount.");
    }

    const year = new Date().getFullYear();
    const lockKey = BigInt(0x56_4f_55_43); // 'VOUC'
    let retries = 3;

    while (retries > 0) {
      try {
        return await db.transaction(async (tx): Promise<ActionResponse<ProjectVoucher>> => {
          const lock = new AdvisoryLock(tx, lockKey);
          const acquired = await lock.acquire();
          if (!acquired) {
            return handleStateError("Too many concurrent requests – please try again");
          }

          const prefix = `VC-${year}-`;
          const existing = await tx
            .select({ voucherNumber: projectVouchers.voucherNumber })
            .from(projectVouchers)
            .where(sql`${projectVouchers.voucherNumber} ilike ${`${prefix}%`}`)
            .orderBy(desc(projectVouchers.voucherNumber))
            .limit(1);

          const seq = extractVoucherSequence(existing[0]?.voucherNumber) + 1;
          const voucherNumber = formatVoucherNumber(seq, year);
          const balance = data.totalAmount - data.paidAmount;

          const [voucher] = await tx
            .insert(projectVouchers)
            .values({
              projectId: data.projectId,
              voucherNumber,
              voucherType: data.voucherType,
              totalAmount: String(data.totalAmount),
              paidAmount: String(data.paidAmount),
              balanceAmount: String(balance),
              notes: data.notes ?? null,
              createdBy: auth.userId,
            })
            .returning();

          if (!voucher) {
            return handleStateError("Failed to generate voucher");
          }

          revalidatePath(`/projects/${data.projectId}`);
          revalidatePath("/projects/completed");

          return successResponse(voucher);
        });
      } catch (error: unknown) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code: string }).code === "23505" &&
          retries > 1
        ) {
          retries--;
          continue;
        }
        throw error;
      }
    }

    return handleStateError("Failed to generate unique voucher number after retries.");
  } catch (error) {
    return handleActionError(error, "generateVoucher", "Failed to generate voucher");
  }
}

export async function getProjectVouchers(
  projectId: string,
): Promise<ActionResponse<ProjectVoucher[]>> {
  try {
    await requireAuth();
    const validatedProjectId = uuidSchema.parse(projectId);
    const vouchers = await db.query.projectVouchers.findMany({
      where: eq(projectVouchers.projectId, validatedProjectId),
      orderBy: [desc(projectVouchers.createdAt)],
    });
    return successResponse(vouchers);
  } catch (error) {
    return handleActionError(error, "getProjectVouchers", "Failed to fetch vouchers");
  }
}

export async function getVoucher(voucherId: string): Promise<ActionResponse<VoucherWithProject>> {
  try {
    await requireAuth();
    const validatedVoucherId = uuidSchema.parse(voucherId);
    const voucher = await db.query.projectVouchers.findFirst({
      where: eq(projectVouchers.id, validatedVoucherId),
      with: {
        project: {
          columns: { projectNumber: true },
          with: { customer: { columns: { name: true } } },
        },
      },
    });
    if (!voucher) return handleNotFoundError("Voucher", voucherId);
    if (!voucher.project) return handleStateError("Project not found for voucher");
    if (!voucher.project.customer) return handleStateError("Customer not found for project");

    return successResponse({
      ...voucher,
      projectNumber: voucher.project.projectNumber,
      customerName: voucher.project.customer.name,
    });
  } catch (error) {
    return handleActionError(error, "getVoucher", "Failed to fetch voucher");
  }
}
