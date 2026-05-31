"use server";

import { desc, eq, sql } from "drizzle-orm";
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
import { LEDGER_ACCOUNT_CODES, type LedgerAccountCode } from "@/lib/domain/finance";

export async function getOwnerPortalData() {
  await requireAuth();
  const db = await getDb();

  // In a real app, we'd calculate Retained Earnings from the ledger:
  // For now, let's just do a mock or simple query.
  // We'll calculate Retained Earnings balance: Credit - Debit for 'retained_earnings' account
  const reAccount = await db.query.ledgerAccounts.findFirst({
    where: eq(ledgerAccounts.code, "retained_earnings"),
  });

  let retainedEarningsBalance = 0;
  if (reAccount) {
    const reLines = await db
      .select({
        debit: sql<number>`SUM(${journalLines.debit}::numeric)`,
        credit: sql<number>`SUM(${journalLines.credit}::numeric)`,
      })
      .from(journalLines)
      .where(eq(journalLines.accountId, reAccount.id));

    // Enforce integer math for MMK
    retainedEarningsBalance =
      Math.round(Number(reLines[0]?.credit || 0)) - Math.round(Number(reLines[0]?.debit || 0));
  }

  const currentYearStart = new Date(new Date().getFullYear(), 0, 1);
  const ytdNetIncomeResult = await db
    .select({
      balance: sql<number>`SUM(${journalLines.credit}::numeric - ${journalLines.debit}::numeric)`,
    })
    .from(journalLines)
    .innerJoin(ledgerAccounts, eq(journalLines.accountId, ledgerAccounts.id))
    .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
    .where(
      sql`${ledgerAccounts.type} IN ('income', 'expense') AND ${journalEntries.entryDate} >= ${currentYearStart}`,
    );

  const ytdNetIncome = Math.round(Number(ytdNetIncomeResult[0]?.balance || 0));

  // Get owners with user info
  const allOwners = await db
    .select({
      id: owners.id,
      userId: owners.userId,
      ownershipPercentage: owners.ownershipPercentage,
      name: users.name,
      email: users.email,
    })
    .from(owners)
    .innerJoin(users, eq(owners.userId, users.id));

  // Get aggregated stats for owners
  const ownerStatsResult = await db
    .select({
      ownerId: ownerTransactions.ownerId,
      type: ownerTransactions.transactionType,
      total: sql<number>`SUM(${ownerTransactions.amount}::numeric)`,
    })
    .from(ownerTransactions)
    .where(eq(ownerTransactions.status, "completed"))
    .groupBy(ownerTransactions.ownerId, ownerTransactions.transactionType);

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
      if (row.type === "capital_contribution") entry.capitalContributed += val;
      if (row.type === "draw") entry.draws += val;
      return acc;
    },
    {} as Record<string, { capitalContributed: number; draws: number }>,
  );

  // Get transactions for owners
  const txs = await db.query.ownerTransactions.findMany({
    orderBy: [desc(ownerTransactions.transactionDate)],
    limit: 100,
  });

  // Get active payment methods for draw/capital call selections
  const activePaymentMethods = await db.query.paymentMethods.findMany({
    where: (methods, { eq }) => eq(methods.isActive, true),
    orderBy: (methods, { asc }) => [asc(methods.name)],
  });

  return {
    retainedEarningsBalance,
    ytdNetIncome,
    paymentMethods: activePaymentMethods,
    owners: allOwners.map((o) => {
      const stats = statsByOwner[o.id] || { capitalContributed: 0, draws: 0 };
      const availableDraw =
        Math.floor((retainedEarningsBalance * Number(o.ownershipPercentage)) / 100) - stats.draws;

      return {
        ...o,
        capitalContributed: stats.capitalContributed,
        availableDraw: Math.max(0, availableDraw),
        ytdDraws: stats.draws,
        transactions: txs.filter((t) => t.ownerId === o.id),
      };
    }),
  };
}

export async function requestOwnerDrawAction(
  rawOwnerId: string,
  rawAmount: number,
  rawPaymentAssetAccountCode: string,
) {
  const user = await requireAuth();
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

  await db.transaction(async (tx) => {
    // For demo purposes, assuming Owner A codes.
    // In production, derive based on `ownerId`.
    const distPayableCode = "owner_a_distributions_payable";

    // Call the finance lib function we created earlier
    const { recordOwnerDraw } = await import("@/lib/finance/equity");
    await recordOwnerDraw({
      tx,
      ownerId,
      amount,
      drawsAccountCode: "owner_a_draws" as LedgerAccountCode, // Need map in prod
      distributionsPayableAccountCode: distPayableCode as LedgerAccountCode,
      paymentAssetAccountCode,
      createdBy: user.userId,
    });
  });

  return { success: true };
}

export async function payCapitalCallAction(
  transactionId: string,
  rawPaymentAssetAccountCode: string,
) {
  const user = await requireAuth();
  const db = await getDb();

  const { paymentAssetAccountCode } = z
    .object({
      paymentAssetAccountCode: z.enum(LEDGER_ACCOUNT_CODES),
    })
    .parse({ paymentAssetAccountCode: rawPaymentAssetAccountCode });

  await db.transaction(async (tx) => {
    const { receiveCapitalContribution } = await import("@/lib/finance/equity");
    await receiveCapitalContribution({
      tx,
      transactionId,
      paymentAssetAccountCode,
      createdBy: user.userId,
    });
  });

  return { success: true };
}
