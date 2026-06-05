"use server";

import { endOfDay, parseISO, startOfDay } from "date-fns";
import { and, desc, eq, exists, gte, inArray, lte, sql } from "drizzle-orm";
import { cache } from "react";
import { requireFinanceAccess } from "@/lib/auth/validate";
import { db } from "@/lib/db";
import type { JournalSourceType, LedgerAccountType } from "@/lib/db/schema";
import { journalEntries, journalLines, ledgerAccounts, projects } from "@/lib/db/schema";
import type { LedgerAccountCode } from "@/lib/domain/finance";
import { type ActionResponse, successResponse } from "@/lib/utils/action-response";
import { handleActionError } from "@/lib/utils/error";
import { ledgerFilterSchema } from "@/lib/validators/ledger";

export interface LedgerEntryRow {
  entryId: string;
  entryDate: Date;
  memo: string | null;
  sourceType: JournalSourceType;
  sourceId: string | null;
  createdBy: string;
  creatorName: string | null;
  isReversed: boolean;
  lines: {
    id: string;
    accountCode: LedgerAccountCode;
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

export const getLedgerEntries = cache(
  async (rawFilters: unknown = {}): Promise<ActionResponse<LedgerPage>> => {
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

      const lineWhereConds = [];
      if (accountCode) {
        lineWhereConds.push(
          inArray(
            journalLines.accountId,
            sql`(select id from ${ledgerAccounts} where code = ${accountCode})`,
          ),
        );
      }
      if (projectId) {
        lineWhereConds.push(eq(journalLines.projectId, projectId));
      }

      const lineExistsCond =
        lineWhereConds.length > 0
          ? exists(
              db
                .select({ id: journalLines.id })
                .from(journalLines)
                .where(and(eq(journalLines.entryId, journalEntries.id), ...lineWhereConds)),
            )
          : undefined;

      const [countRow] = await db
        .select({ count: sql<number>`cast(count(distinct ${journalEntries.id}) as int)` })
        .from(journalEntries)
        .where(and(baseWhere, lineExistsCond));

      const totalCount = countRow?.count ?? 0;
      const totalPages = Math.ceil(totalCount / limit);

      if (totalCount === 0) {
        return successResponse({
          entries: [],
          total: totalCount,
          page,
          limit,
          totalPages,
        });
      }

      const entryRows = await db.query.journalEntries.findMany({
        where: and(baseWhere, lineExistsCond),
        with: {
          createdBy: true,
          lines: {
            with: {
              account: true,
              project: true,
            },
          },
        },
        orderBy: [desc(journalEntries.entryDate), desc(journalEntries.createdAt)],
        limit,
        offset: (page - 1) * limit,
      });

      const entries: LedgerEntryRow[] = entryRows.map((row) => ({
        entryId: row.id,
        entryDate: row.entryDate,
        memo: row.memo,
        sourceType: row.sourceType as JournalSourceType,
        sourceId: row.sourceId,
        createdBy: row.createdBy,
        creatorName: row.createdBy?.name ?? "System",
        isReversed: row.isReversed,
        lines: row.lines.map((line) => ({
          id: line.id,
          accountCode: line.account.code as LedgerAccountCode,
          accountName: line.account.name,
          projectId: line.projectId,
          projectNumber: line.project?.projectNumber ?? null,
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
  },
);

export interface AccountBalanceRow {
  accountCode: LedgerAccountCode;
  accountName: string;
  accountType: LedgerAccountType;
  totalDebit: number;
  totalCredit: number;
  balance: number;
}

export const getAccountBalances = cache(
  async (rawFilters: unknown = {}): Promise<ActionResponse<AccountBalanceRow[]>> => {
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
          totalDebit: sql<string>`coalesce(sum(${journalLines.debit}::numeric), 0)`.as(
            "total_debit",
          ),
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
          accountCode: row.accountCode as LedgerAccountCode,
          accountName: row.accountName,
          accountType: row.accountType as LedgerAccountType,
          totalDebit: debit,
          totalCredit: credit,
          balance,
        };
      });

      return successResponse(balances);
    } catch (error) {
      return handleActionError(error, "getAccountBalances", "Failed to fetch account balances");
    }
  },
);

export const getLedgerProjects = cache(
  async (): Promise<ActionResponse<{ id: string; projectNumber: string }[]>> => {
    try {
      await requireFinanceAccess();

      const rows = await db
        .select({
          id: projects.id,
          projectNumber: projects.projectNumber,
        })
        .from(projects)
        .orderBy(desc(projects.createdAt))
        .limit(200);

      return successResponse(rows);
    } catch (error) {
      return handleActionError(error, "getLedgerProjects", "Failed to fetch projects");
    }
  },
);
