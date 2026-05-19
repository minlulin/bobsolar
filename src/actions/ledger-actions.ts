"use server";

import { endOfDay, parseISO, startOfDay } from "date-fns";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { requireFinanceAccess } from "@/lib/auth/validate";
import { db } from "@/lib/db";
import { journalEntries, journalLines, ledgerAccounts, projects, users } from "@/lib/db/schema";
import { JOURNAL_SOURCE_TYPES, LEDGER_ACCOUNT_CODES } from "@/lib/domain/enums";
import { type ActionResponse, successResponse } from "@/lib/utils/action-response";
import { handleActionError } from "@/lib/utils/error";

const ledgerFilterSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  accountCode: z.enum(LEDGER_ACCOUNT_CODES).optional(),
  projectId: z.string().uuid().optional(),
  sourceType: z.enum(JOURNAL_SOURCE_TYPES).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(10).max(100).default(50),
});

export type LedgerFilter = z.input<typeof ledgerFilterSchema>;
export type LedgerFilterParsed = z.output<typeof ledgerFilterSchema>;

export interface LedgerEntryRow {
  entryId: string;
  entryDate: Date;
  memo: string | null;
  sourceType: string;
  sourceId: string | null;
  createdBy: string;
  creatorName: string | null;
  isReversed: boolean;
  lines: {
    id: string;
    accountCode: string;
    accountName: string;
    projectId: string | null;
    projectNumber: string | null;
    debit: number;
    credit: number;
    memo: string | null;
  }[];
}

export interface LedgerPage {
  entries: LedgerEntryRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function getLedgerEntries(
  rawFilters: unknown = {},
): Promise<ActionResponse<LedgerPage>> {
  try {
    await requireFinanceAccess();

    const filters = ledgerFilterSchema.parse(rawFilters);
    const { dateFrom, dateTo, accountCode, projectId, sourceType, page, limit } = filters;

    const dateFromCond = dateFrom
      ? gte(journalEntries.entryDate, startOfDay(parseISO(dateFrom)))
      : undefined;
    const dateToCond = dateTo
      ? lte(journalEntries.entryDate, endOfDay(parseISO(dateTo)))
      : undefined;
    const sourceTypeCond = sourceType ? eq(journalEntries.sourceType, sourceType) : undefined;

    const baseWhere = and(dateFromCond, dateToCond, sourceTypeCond);

    const accountFilter = accountCode
      ? inArray(
          journalLines.accountId,
          sql`(
          select id from ${ledgerAccounts} where code = ${accountCode}
        )`,
        )
      : undefined;

    const projectFilter = projectId ? eq(journalLines.projectId, projectId) : undefined;

    const lineWhere = and(accountFilter, projectFilter);

    const [countRow] = await db
      .select({ count: sql<number>`cast(count(distinct ${journalEntries.id}) as int)` })
      .from(journalEntries)
      .innerJoin(journalLines, eq(journalLines.entryId, journalEntries.id))
      .where(and(baseWhere, lineWhere));

    const totalCount = countRow?.count ?? 0;
    const totalPages = Math.ceil(totalCount / limit);

    const entryRows = await db
      .select({
        id: journalEntries.id,
        entryDate: journalEntries.entryDate,
        memo: journalEntries.memo,
        sourceType: journalEntries.sourceType,
        sourceId: journalEntries.sourceId,
        createdBy: journalEntries.createdBy,
        isReversed: journalEntries.isReversed,
        creatorName: users.name,
      })
      .from(journalEntries)
      .leftJoin(users, eq(journalEntries.createdBy, users.id))
      .innerJoin(journalLines, eq(journalLines.entryId, journalEntries.id))
      .where(and(baseWhere, lineWhere))
      .groupBy(
        journalEntries.id,
        journalEntries.entryDate,
        journalEntries.memo,
        journalEntries.sourceType,
        journalEntries.sourceId,
        journalEntries.createdBy,
        journalEntries.isReversed,
        users.name,
      )
      .orderBy(desc(journalEntries.entryDate), desc(journalEntries.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);

    if (entryRows.length === 0) {
      return successResponse({
        entries: [],
        total: totalCount,
        page,
        limit,
        totalPages,
      });
    }

    const entryIds = entryRows.map((r) => r.id);

    const lineRows = await db
      .select({
        entryId: journalLines.entryId,
        id: journalLines.id,
        accountCode: ledgerAccounts.code,
        accountName: ledgerAccounts.name,
        projectId: journalLines.projectId,
        projectNumber: projects.projectNumber,
        debit: journalLines.debit,
        credit: journalLines.credit,
        memo: journalLines.memo,
      })
      .from(journalLines)
      .innerJoin(ledgerAccounts, eq(journalLines.accountId, ledgerAccounts.id))
      .leftJoin(projects, eq(journalLines.projectId, projects.id))
      .where(inArray(journalLines.entryId, entryIds))
      .orderBy(journalLines.entryId, journalLines.id);

    const linesByEntry = new Map<string, typeof lineRows>();
    for (const line of lineRows) {
      const bucket = linesByEntry.get(line.entryId) ?? [];
      bucket.push(line);
      linesByEntry.set(line.entryId, bucket);
    }

    const entries: LedgerEntryRow[] = entryRows.map((row) => ({
      entryId: row.id,
      entryDate: row.entryDate,
      memo: row.memo,
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      createdBy: row.createdBy,
      creatorName: row.creatorName,
      isReversed: row.isReversed,
      lines: (linesByEntry.get(row.id) ?? []).map((line) => ({
        id: line.id,
        accountCode: line.accountCode,
        accountName: line.accountName,
        projectId: line.projectId,
        projectNumber: line.projectNumber,
        debit: Math.round(Number(line.debit)),
        credit: Math.round(Number(line.credit)),
        memo: line.memo,
      })),
    }));

    return successResponse({
      entries,
      total: totalCount,
      page,
      limit,
      totalPages,
    });
  } catch (error) {
    return handleActionError(error, "getLedgerEntries", "Failed to fetch ledger entries");
  }
}

export interface AccountBalanceRow {
  accountCode: string;
  accountName: string;
  accountType: string;
  totalDebit: number;
  totalCredit: number;
  balance: number;
}

export async function getAccountBalances(
  rawFilters: unknown = {},
): Promise<ActionResponse<AccountBalanceRow[]>> {
  try {
    await requireFinanceAccess();

    const filters = ledgerFilterSchema.parse(rawFilters);
    const { dateFrom, dateTo } = filters;

    const dateFromCond = dateFrom
      ? gte(journalEntries.entryDate, startOfDay(parseISO(dateFrom)))
      : undefined;
    const dateToCond = dateTo
      ? lte(journalEntries.entryDate, endOfDay(parseISO(dateTo)))
      : undefined;

    const rows = await db
      .select({
        accountCode: ledgerAccounts.code,
        accountName: ledgerAccounts.name,
        accountType: ledgerAccounts.type,
        totalDebit: sql<string>`coalesce(sum(${journalLines.debit}::numeric), 0)`.as("total_debit"),
        totalCredit: sql<string>`coalesce(sum(${journalLines.credit}::numeric), 0)`.as(
          "total_credit",
        ),
      })
      .from(journalLines)
      .innerJoin(ledgerAccounts, eq(journalLines.accountId, ledgerAccounts.id))
      .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .where(and(dateFromCond, dateToCond, eq(journalEntries.isReversed, false)))
      .groupBy(ledgerAccounts.code, ledgerAccounts.name, ledgerAccounts.type)
      .orderBy(ledgerAccounts.code);

    const balances: AccountBalanceRow[] = rows.map((row) => {
      const debit = Math.round(Number(row.totalDebit));
      const credit = Math.round(Number(row.totalCredit));
      const isAsset = row.accountType === "asset" || row.accountType === "expense";
      const balance = isAsset ? debit - credit : credit - debit;

      return {
        accountCode: row.accountCode,
        accountName: row.accountName,
        accountType: row.accountType,
        totalDebit: debit,
        totalCredit: credit,
        balance,
      };
    });

    return successResponse(balances);
  } catch (error) {
    return handleActionError(error, "getAccountBalances", "Failed to fetch account balances");
  }
}

export async function getLedgerProjects(): Promise<
  ActionResponse<{ id: string; projectNumber: string }[]>
> {
  try {
    await requireFinanceAccess();

    const rows = await db
      .select({
        id: projects.id,
        projectNumber: projects.projectNumber,
      })
      .from(projects)
      .orderBy(desc(projects.createdAt));

    return successResponse(rows);
  } catch (error) {
    return handleActionError(error, "getLedgerProjects", "Failed to fetch projects");
  }
}
