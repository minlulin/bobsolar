import { eq } from "drizzle-orm";
import { owners, ownerTransactions } from "@/lib/db/schema";
import type { LedgerAccountCode } from "@/lib/domain/finance";
import { OWNER_TX_STATUSES, OWNER_TX_TYPES } from "@/lib/domain/owner-transaction";
import { getPartnerByEmail, type PartnerConfig } from "@/lib/domain/partners";
import { createBalancedJournalEntry, type DbTransaction } from "./ledger";

/**
 * Resolve a partner's ledger account codes from their DB owner ID.
 * Joins owners → users to get the email, then looks up the partner registry.
 */
export async function resolvePartnerAccounts(
  tx: DbTransaction,
  ownerId: string,
): Promise<PartnerConfig["accounts"]> {
  const ownerWithUser = await tx.query.owners.findFirst({
    where: eq(owners.id, ownerId),
    with: { user: { columns: { email: true } } },
  });

  if (!ownerWithUser?.user?.email) {
    throw new Error(`Owner ${ownerId} not found or has no linked user email.`);
  }

  const partner = getPartnerByEmail(ownerWithUser.user.email);
  if (!partner) {
    throw new Error(
      `No partner configured for email: ${ownerWithUser.user.email}. ` +
        `Set SEED_PARTNERS env var with this partner's details.`,
    );
  }

  return partner.accounts;
}

type DistributeNetIncomeInput = {
  tx: DbTransaction;
  totalDistributionAmount: number;
  distributions: Array<{
    ownerId: string;
    distributionsPayableAccountCode: LedgerAccountCode;
    amount: number;
  }>;
  distributionDate?: Date;
  createdBy: string;
};

/**
 * Distributes Net Income (or a portion of Retained Earnings) to Owners.
 * Standard Policy: 90% distributed, 10% retained. (Caller calculates the 90%)
 * Debit: Retained Earnings
 * Credit: Owner A Distributions Payable
 * Credit: Owner B Distributions Payable
 * ...
 */
export async function distributeNetIncome(
  input: DistributeNetIncomeInput,
): Promise<{ journalEntryId: string; transactionIds: string[] }> {
  const date = input.distributionDate ?? new Date();

  // Create Journal Entry
  const lines = [
    {
      accountCode: "retained_earnings" as LedgerAccountCode,
      debit: input.totalDistributionAmount,
      credit: 0,
      memo: "Distribution of Net Income",
    },
  ];

  let totalCredit = 0;
  for (const dist of input.distributions) {
    lines.push({
      accountCode: dist.distributionsPayableAccountCode,
      debit: 0,
      credit: dist.amount,
      memo: `Dividend Distribution`,
    });
    totalCredit += dist.amount;
  }

  if (Math.round(totalCredit) !== Math.round(input.totalDistributionAmount)) {
    throw new Error("Distribution amounts do not match total distribution amount.");
  }

  const journalResult = await createBalancedJournalEntry({
    tx: input.tx,
    entryDate: date,
    memo: `Net Income Distribution to Shareholders`,
    sourceType: "equity_distribution",
    sourceId: null, // Global event
    createdBy: input.createdBy,
    lines,
  });

  // Record transactions for each owner
  const transactionIds: string[] = [];
  for (const dist of input.distributions) {
    const [txRecord] = await input.tx
      .insert(ownerTransactions)
      .values({
        ownerId: dist.ownerId,
        transactionType: OWNER_TX_TYPES.DISTRIBUTION,
        amount: String(dist.amount),
        transactionDate: date,
        status: OWNER_TX_STATUSES.COMPLETED,
        journalEntryId: journalResult.entryId,
      })
      .returning({ id: ownerTransactions.id });

    if (txRecord) transactionIds.push(txRecord.id);
  }

  return { journalEntryId: journalResult.entryId, transactionIds };
}

type RecordOwnerDrawInput = {
  tx: DbTransaction;
  ownerId: string;
  drawsAccountCode: LedgerAccountCode;
  distributionsPayableAccountCode: LedgerAccountCode;
  paymentAssetAccountCode: LedgerAccountCode; // Cash or Bank
  amount: number;
  drawDate?: Date;
  createdBy: string;
};

/**
 * Records an Owner's Draw against their Distribution Payable balance.
 * Debit: Owner X Distributions Payable
 * Credit: Cash / Bank
 */
export async function recordOwnerDraw(
  input: RecordOwnerDrawInput,
): Promise<{ transactionId: string; journalEntryId: string }> {
  const date = input.drawDate ?? new Date();

  // Create Journal Entry
  const journalResult = await createBalancedJournalEntry({
    tx: input.tx,
    entryDate: date,
    memo: `Owner Draw`,
    sourceType: "owner_draw",
    sourceId: null,
    createdBy: input.createdBy,
    lines: [
      {
        accountCode: input.distributionsPayableAccountCode,
        debit: input.amount,
        credit: 0,
      },
      {
        accountCode: input.paymentAssetAccountCode,
        debit: 0,
        credit: input.amount,
      },
    ],
  });

  const [txRecord] = await input.tx
    .insert(ownerTransactions)
    .values({
      ownerId: input.ownerId,
      transactionType: OWNER_TX_TYPES.DRAW,
      amount: String(input.amount),
      transactionDate: date,
      status: OWNER_TX_STATUSES.COMPLETED,
      journalEntryId: journalResult.entryId,
    })
    .returning({ id: ownerTransactions.id });

  if (!txRecord) throw new Error("Failed to create owner transaction");
  return { transactionId: txRecord.id, journalEntryId: journalResult.entryId };
}

type IssueCapitalCallInput = {
  tx: DbTransaction;
  ownerId: string;
  capitalAccountCode: LedgerAccountCode;
  amount: number;
  callDate?: Date;
  createdBy: string;
};

/**
 * Issues a Capital Call to an Owner (Net Loss month).
 * Debit: Accounts Receivable (or specific Capital Call Receivable)
 * Credit: Owner X Capital Contributions
 */
export async function issueCapitalCall(
  input: IssueCapitalCallInput,
): Promise<{ transactionId: string; journalEntryId: string }> {
  const date = input.callDate ?? new Date();

  const journalResult = await createBalancedJournalEntry({
    tx: input.tx,
    entryDate: date,
    memo: `Capital Call Issued`,
    sourceType: "capital_call",
    sourceId: null,
    createdBy: input.createdBy,
    lines: [
      {
        accountCode: "accounts_receivable", // Could be a specific capital call receivable account
        debit: input.amount,
        credit: 0,
      },
      {
        accountCode: input.capitalAccountCode,
        debit: 0,
        credit: input.amount,
      },
    ],
  });

  const [txRecord] = await input.tx
    .insert(ownerTransactions)
    .values({
      ownerId: input.ownerId,
      transactionType: OWNER_TX_TYPES.CAPITAL_CALL_ISSUED,
      amount: String(input.amount),
      transactionDate: date,
      status: OWNER_TX_STATUSES.PENDING,
      journalEntryId: journalResult.entryId,
    })
    .returning({ id: ownerTransactions.id });

  if (!txRecord) throw new Error("Failed to create owner transaction");
  return { transactionId: txRecord.id, journalEntryId: journalResult.entryId };
}

type ReceiveCapitalContributionInput = {
  tx: DbTransaction;
  transactionId: string; // The pending capital_call_issued transaction
  paymentAssetAccountCode: LedgerAccountCode;
  paymentDate?: Date;
  createdBy: string;
};

/**
 * Records the receipt of Capital Call funds.
 * Debit: Cash / Bank
 * Credit: Accounts Receivable
 */
export async function receiveCapitalContribution(
  input: ReceiveCapitalContributionInput,
): Promise<{ journalEntryId: string }> {
  const date = input.paymentDate ?? new Date();

  const pendingCall = await input.tx.query.ownerTransactions.findFirst({
    where: eq(ownerTransactions.id, input.transactionId),
  });

  if (!pendingCall) throw new Error("Capital call transaction not found.");
  if (pendingCall.status === OWNER_TX_STATUSES.COMPLETED)
    throw new Error("Capital call already paid.");

  const journalResult = await createBalancedJournalEntry({
    tx: input.tx,
    entryDate: date,
    memo: `Capital Call Payment Received`,
    sourceType: "capital_call",
    sourceId: pendingCall.id,
    createdBy: input.createdBy,
    lines: [
      {
        accountCode: input.paymentAssetAccountCode,
        debit: Number(pendingCall.amount),
        credit: 0,
      },
      {
        accountCode: "accounts_receivable",
        debit: 0,
        credit: Number(pendingCall.amount),
      },
    ],
  });

  await input.tx
    .update(ownerTransactions)
    .set({
      status: OWNER_TX_STATUSES.COMPLETED,
    })
    .where(eq(ownerTransactions.id, input.transactionId));

  return { journalEntryId: journalResult.entryId };
}
