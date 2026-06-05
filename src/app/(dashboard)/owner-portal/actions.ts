"use server";

import { desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cache } from "react";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/validate";
import { getDb } from "@/lib/db";
import {
  journalEntries,
  journalLines,
  ledgerAccounts,
  owners,
  ownerTransactions,
  users,
} from "@/lib/db/schema";
import { LEDGER_ACCOUNT_CODES } from "@/lib/domain/finance";
import { OWNER_TX_STATUSES, OWNER_TX_TYPES } from "@/lib/domain/owner-transaction";
import { type ActionResponse, errorResponse, successResponse } from "@/lib/utils/action-response";
import { handleActionError } from "@/lib/utils/error";

export const getOwnerPortalData = cache(async function getOwnerPortalData(): Promise<
  ActionResponse<{
    retainedEarningsBalance: number;
    ytdNetIncome: number;
    owners: Array<{
      id: string;
      userId: string;
      ownershipPercentage: string;
      name: string;
      email: string;
      capitalContributed: number;
      availableDraw: number;
      ytdDraws: number;
      transactions: Array<{
        id: string;
        ownerId: string | null;
        transactionType: string;
        amount: string;
        transactionDate: Date;
        status: string;
        journalEntryId: string | null;
        createdAt: Date;
      }>;
    }>;
  }>
> {
  try {
    await requireAuth();
    const db = await getDb();

    const currentYearStart = new Date(new Date().getFullYear(), 0, 1);

    const [reAccount, ytdNetIncomeResult, allOwners, ownerStatsResult, txs] = await Promise.all([
      db.query.ledgerAccounts.findFirst({
        where: eq(ledgerAccounts.code, "retained_earnings"),
      }),
      db
        .select({
          balance: sql<number>`SUM(${journalLines.credit}::numeric - ${journalLines.debit}::numeric)`,
        })
        .from(journalLines)
        .innerJoin(ledgerAccounts, eq(journalLines.accountId, ledgerAccounts.id))
        .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
        .where(
          sql`${ledgerAccounts.type} IN ('income', 'expense') AND ${journalEntries.entryDate} >= ${currentYearStart}`,
        ),
      db
        .select({
          id: owners.id,
          userId: owners.userId,
          ownershipPercentage: owners.ownershipPercentage,
          name: users.name,
          email: users.email,
        })
        .from(owners)
        .innerJoin(users, eq(owners.userId, users.id)),
      db
        .select({
          ownerId: ownerTransactions.ownerId,
          type: ownerTransactions.transactionType,
          total: sql<number>`SUM(${ownerTransactions.amount}::numeric)`,
        })
        .from(ownerTransactions)
        .where(eq(ownerTransactions.status, OWNER_TX_STATUSES.COMPLETED))
        .groupBy(ownerTransactions.ownerId, ownerTransactions.transactionType),
      db.query.ownerTransactions.findMany({
        orderBy: [desc(ownerTransactions.transactionDate)],
        limit: 100,
      }),
    ]);

    let retainedEarningsBalance = 0;
    if (reAccount) {
      const reLines = await db
        .select({
          debit: sql<number>`SUM(${journalLines.debit}::numeric)`,
          credit: sql<number>`SUM(${journalLines.credit}::numeric)`,
        })
        .from(journalLines)
        .where(eq(journalLines.accountId, reAccount.id));

      retainedEarningsBalance =
        Math.round(Number(reLines[0]?.credit || 0)) - Math.round(Number(reLines[0]?.debit || 0));
    }

    const ytdNetIncome = Math.round(Number(ytdNetIncomeResult[0]?.balance || 0));

    const statsByOwner = ownerStatsResult.reduce(
      (acc, row) => {
        const ownerId = row.ownerId;
        if (!ownerId) return acc;
        if (!acc[ownerId]) {
          acc[ownerId] = { capitalContributed: 0, draws: 0 };
        }
        const entry = acc[ownerId];
        if (!entry) return acc;
        const val = Math.round(Number(row.total || 0));
        if (row.type === OWNER_TX_TYPES.CAPITAL_CONTRIBUTION) entry.capitalContributed += val;
        if (row.type === OWNER_TX_TYPES.DRAW) entry.draws += val;
        return acc;
      },
      {} as Record<string, { capitalContributed: number; draws: number }>,
    );

    return successResponse({
      retainedEarningsBalance,
      ytdNetIncome,
      owners: allOwners.map((o) => {
        const stats = statsByOwner[o.id] || { capitalContributed: 0, draws: 0 };
        const availableDraw =
          Math.round((retainedEarningsBalance * Number(o.ownershipPercentage)) / 100) - stats.draws;

        return {
          ...o,
          capitalContributed: stats.capitalContributed,
          availableDraw: Math.max(0, availableDraw),
          ytdDraws: stats.draws,
          transactions: txs.filter((t) => t.ownerId === o.id),
        };
      }),
    });
  } catch (error) {
    return handleActionError(error, "getOwnerPortalData", "Failed to fetch owner portal data");
  }
});

export async function requestOwnerDrawAction(
  rawOwnerId: string,
  rawAmount: number,
  rawPaymentAssetAccountCode: string,
): Promise<ActionResponse<{ transactionId: string; journalEntryId: string }>> {
  try {
    const auth = await requireAuth();
    const db = await getDb();

    const { ownerId, amount, paymentAssetAccountCode } = z
      .object({
        ownerId: z.string().uuid(),
        amount: z.number().int().positive(),
        paymentAssetAccountCode: z.enum(LEDGER_ACCOUNT_CODES),
      })
      .parse({
        ownerId: rawOwnerId,
        amount: rawAmount,
        paymentAssetAccountCode: rawPaymentAssetAccountCode,
      });

    const owner = await db.query.owners.findFirst({
      where: eq(owners.id, ownerId),
      columns: { userId: true },
    });

    if (!owner) {
      return errorResponse("Owner not found");
    }

    if (owner.userId !== auth.userId && auth.role !== "admin") {
      return errorResponse("You can only request draws for your own account");
    }

    const result = await db.transaction(async (tx) => {
      const { resolvePartnerAccounts, recordOwnerDraw } = await import("@/lib/finance/equity");
      const accounts = await resolvePartnerAccounts(tx, ownerId);

      const reAccount = await tx.query.ledgerAccounts.findFirst({
        where: eq(ledgerAccounts.code, "retained_earnings"),
      });

      if (reAccount) {
        const reLines = await tx
          .select({
            debit: sql<number>`SUM(${journalLines.debit}::numeric)`,
            credit: sql<number>`SUM(${journalLines.credit}::numeric)`,
          })
          .from(journalLines)
          .where(eq(journalLines.accountId, reAccount.id));

        const retainedEarningsBalance =
          Math.round(Number(reLines[0]?.credit || 0)) - Math.round(Number(reLines[0]?.debit || 0));

        const ownerStats = await tx
          .select({
            total: sql<number>`COALESCE(SUM(${ownerTransactions.amount}::numeric), 0)`,
          })
          .from(ownerTransactions)
          .where(
            sql`${ownerTransactions.ownerId} = ${ownerId} AND ${ownerTransactions.transactionType} = ${OWNER_TX_TYPES.DRAW} AND ${ownerTransactions.status} = ${OWNER_TX_STATUSES.COMPLETED}`,
          );

        const totalDraws = Math.round(Number(ownerStats[0]?.total || 0));
        const ownerRecord = await tx.query.owners.findFirst({
          where: eq(owners.id, ownerId),
          columns: { ownershipPercentage: true },
        });

        const availableDraw =
          Math.round(
            (retainedEarningsBalance * Number(ownerRecord?.ownershipPercentage || 0)) / 100,
          ) - totalDraws;

        if (amount > availableDraw) {
          throw new Error(
            `Insufficient distribution balance. Available: ${availableDraw} MMK, Requested: ${amount} MMK`,
          );
        }
      }

      return recordOwnerDraw({
        tx,
        ownerId,
        amount,
        drawsAccountCode: accounts.draws,
        distributionsPayableAccountCode: accounts.distributionsPayable,
        paymentAssetAccountCode,
        createdBy: auth.userId,
      });
    });

    revalidatePath("/owner-portal");
    return successResponse(result);
  } catch (error) {
    return handleActionError(error, "requestOwnerDrawAction", "Failed to process owner draw");
  }
}

export async function payCapitalCallAction(
  transactionId: string,
  rawPaymentAssetAccountCode: string,
): Promise<ActionResponse<{ journalEntryId: string }>> {
  try {
    const auth = await requireAuth();
    const db = await getDb();

    const { paymentAssetAccountCode } = z
      .object({
        paymentAssetAccountCode: z.enum(LEDGER_ACCOUNT_CODES),
      })
      .parse({ paymentAssetAccountCode: rawPaymentAssetAccountCode });

    const pendingCall = await db.query.ownerTransactions.findFirst({
      where: eq(ownerTransactions.id, transactionId),
      columns: { ownerId: true, status: true },
    });

    if (!pendingCall) {
      return errorResponse("Capital call transaction not found");
    }

    if (pendingCall.status === OWNER_TX_STATUSES.COMPLETED) {
      return errorResponse("Capital call is already paid");
    }

    const owner = await db.query.owners.findFirst({
      where: eq(owners.id, pendingCall.ownerId),
      columns: { userId: true },
    });

    if (owner?.userId !== auth.userId && auth.role !== "admin") {
      return errorResponse("You can only pay capital calls for your own account");
    }

    const result = await db.transaction(async (tx) => {
      const { receiveCapitalContribution } = await import("@/lib/finance/equity");
      return receiveCapitalContribution({
        tx,
        transactionId,
        paymentAssetAccountCode,
        createdBy: auth.userId,
      });
    });

    revalidatePath("/owner-portal");
    return successResponse(result);
  } catch (error) {
    return handleActionError(
      error,
      "payCapitalCallAction",
      "Failed to process capital call payment",
    );
  }
}
