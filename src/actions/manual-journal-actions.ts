"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/validate";
import { db } from "@/lib/db";
import type { LedgerAccountType } from "@/lib/db/schema";
import { ledgerAccounts, projects } from "@/lib/db/schema";
import type { LedgerAccountCode } from "@/lib/domain/finance";
import { createBalancedJournalEntry } from "@/lib/finance/ledger";
import { type ActionResponse, successResponse } from "@/lib/utils/action-response";
import { handleActionError, handleStateError } from "@/lib/utils/error";
import { manualJournalSchema } from "@/lib/validators/manual-journal";

export async function createManualJournalEntry(
  raw: unknown,
): Promise<ActionResponse<{ entryId: string }>> {
  try {
    const auth = await requireAdmin();

    const data = manualJournalSchema.parse(raw);

    if (data.projectId) {
      const project = await db.query.projects.findFirst({
        where: eq(projects.id, data.projectId),
      });
      if (!project) {
        return handleStateError("Project not found.");
      }
    }

    const result = await db.transaction(async (tx) => {
      const entry = await createBalancedJournalEntry({
        tx,
        entryDate: data.entryDate,
        memo: data.memo,
        sourceType: data.sourceType,
        sourceId: data.projectId ?? null,
        projectId: data.projectId ?? null,
        createdBy: auth.userId,
        lines: data.lines.map((line) => ({
          accountCode: line.accountCode,
          debit: Math.round(line.debit),
          credit: Math.round(line.credit),
          memo: line.memo ?? null,
        })),
      });

      return entry;
    });

    revalidatePath("/finance/ledger");
    revalidatePath("/finance");
    revalidatePath("/");

    return successResponse(result);
  } catch (error) {
    return handleActionError(error, "createManualJournalEntry", "Failed to create journal entry");
  }
}

export interface LedgerAccountOption {
  code: LedgerAccountCode;
  name: string;
  type: LedgerAccountType;
}

export async function getLedgerAccountOptions(): Promise<ActionResponse<LedgerAccountOption[]>> {
  try {
    await requireAdmin();

    const accounts = await db.query.ledgerAccounts.findMany({
      where: eq(ledgerAccounts.isActive, true),
      orderBy: (accounts, { asc }) => [asc(accounts.code)],
    });

    return successResponse(
      accounts.map((a) => ({
        code: a.code as LedgerAccountCode,
        name: a.name,
        type: a.type as LedgerAccountType,
      })),
    );
  } catch (error) {
    return handleActionError(error, "getLedgerAccountOptions", "Failed to fetch ledger accounts");
  }
}

export async function getProjectOptions(): Promise<
  ActionResponse<{ id: string; projectNumber: string }[]>
> {
  try {
    await requireAdmin();

    const projectsList = await db.query.projects.findMany({
      columns: {
        id: true,
        projectNumber: true,
      },
      orderBy: (projects, { desc }) => [desc(projects.createdAt)],
      limit: 100,
    });

    return successResponse(projectsList);
  } catch (error) {
    return handleActionError(error, "getProjectOptions", "Failed to fetch projects");
  }
}
