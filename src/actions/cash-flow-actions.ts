"use server";

import { endOfDay, parseISO, startOfDay, startOfMonth, subMonths } from "date-fns";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { requireFinanceAccess } from "@/lib/auth/validate";
import { db } from "@/lib/db";
import { journalEntries, journalLines, ledgerAccounts } from "@/lib/db/schema";
import {
  CASH_ACCOUNT_CODES as CASH_ACCOUNTS,
  INVESTING_SOURCE_TYPES,
  OPERATING_SOURCE_TYPES,
} from "@/lib/domain/finance";
import { type ActionResponse, successResponse } from "@/lib/utils/action-response";
import { handleActionError } from "@/lib/utils/error";

const cashFlowFilterSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export interface CashFlowLine {
  label: string;
  inflows: number;
  outflows: number;
  net: number;
}

export interface CashFlowSection {
  label: string;
  lines: CashFlowLine[];
  totalInflows: number;
  totalOutflows: number;
  net: number;
}

export interface CashFlowStatement {
  operating: CashFlowSection;
  investing: CashFlowSection;
  financing: CashFlowSection;
  netCashFromOperating: number;
  netCashFromInvesting: number;
  netCashFromFinancing: number;
  netCashChange: number;
  beginningCash: number;
  endingCash: number;
  dateFrom: string;
  dateTo: string;
}

// Constants imported from domain

export async function getCashFlowStatement(
  rawFilters: unknown = {},
): Promise<ActionResponse<CashFlowStatement>> {
  try {
    await requireFinanceAccess();

    const filters = cashFlowFilterSchema.parse(rawFilters);
    const dateFrom = filters.dateFrom
      ? startOfDay(parseISO(filters.dateFrom))
      : startOfMonth(subMonths(new Date(), 11));
    const dateTo = filters.dateTo ? endOfDay(parseISO(filters.dateTo)) : new Date();

    // Fetch all journal entries with their lines, accounts, and source types
    const rows = await db
      .select({
        id: journalEntries.id,
        sourceType: journalEntries.sourceType,
        sourceId: journalEntries.sourceId,
        entryDate: journalEntries.entryDate,
        accountCode: ledgerAccounts.code,
        accountType: ledgerAccounts.type,
        debit: sql<string>`coalesce(${journalLines.debit}::numeric, 0)`.as("debit"),
        credit: sql<string>`coalesce(${journalLines.credit}::numeric, 0)`.as("credit"),
      })
      .from(journalEntries)
      .innerJoin(journalLines, eq(journalLines.entryId, journalEntries.id))
      .innerJoin(ledgerAccounts, eq(journalLines.accountId, ledgerAccounts.id))
      .where(
        and(
          gte(journalEntries.entryDate, dateFrom),
          lte(journalEntries.entryDate, dateTo),
          eq(journalEntries.isReversed, false),
        ),
      )
      .orderBy(desc(journalEntries.entryDate));

    // Classify each entry into operating/investing/financing
    // A cash flow entry is: cash account involved + income/expense account involved
    // Inflow = credit to income account (receiving money)
    // Outflow = debit to expense account (spending money)

    const operatingLines = new Map<string, { inflows: number; outflows: number }>();
    const investingLines = new Map<string, { inflows: number; outflows: number }>();
    const financingLines = new Map<string, { inflows: number; outflows: number }>();

    // Group lines by source entry
    const entryMap = new Map<
      string,
      {
        sourceType: string;
        lines: { accountCode: string; accountType: string; debit: number; credit: number }[];
      }
    >();

    for (const row of rows) {
      const entryId = row.id;
      const sourceType = row.sourceType ?? "manual_adjustment";
      if (!entryMap.has(entryId)) {
        entryMap.set(entryId, { sourceType, lines: [] });
      }
      entryMap.get(entryId)?.lines.push({
        accountCode: row.accountCode,
        accountType: row.accountType,
        debit: Math.round(Number(row.debit)),
        credit: Math.round(Number(row.credit)),
      });
    }

    for (const [, entry] of entryMap) {
      const hasCashAccount = entry.lines.some((l) =>
        (CASH_ACCOUNTS as readonly string[]).includes(l.accountCode),
      );
      if (!hasCashAccount) continue;

      const category = OPERATING_SOURCE_TYPES.includes(
        entry.sourceType as (typeof OPERATING_SOURCE_TYPES)[number],
      )
        ? "operating"
        : INVESTING_SOURCE_TYPES.includes(
              entry.sourceType as (typeof INVESTING_SOURCE_TYPES)[number],
            )
          ? "investing"
          : "financing";

      const targetLines =
        category === "operating"
          ? operatingLines
          : category === "investing"
            ? investingLines
            : financingLines;

      let entryInflow = 0;
      let entryOutflow = 0;
      for (const line of entry.lines) {
        if ((CASH_ACCOUNTS as readonly string[]).includes(line.accountCode)) {
          entryInflow += line.debit;
          entryOutflow += line.credit;
        }
      }

      if (entryInflow > 0 || entryOutflow > 0) {
        let key = "Other Cash Movement";
        if (entry.sourceType === "project_payment") {
          key = "Customer Payments Received";
        } else if (entry.sourceType === "supplier_payment") {
          key = "Supplier Payments";
        } else if (entry.sourceType === "project_expense") {
          key = "Project Expenses";
        } else if (entry.sourceType === "manual_adjustment") {
          key = "Manual Adjustments / Financing";
        }

        const existing = targetLines.get(key) ?? { inflows: 0, outflows: 0 };
        existing.inflows += entryInflow;
        existing.outflows += entryOutflow;
        targetLines.set(key, existing);
      }
    }

    // Build sections
    const buildSection = (
      label: string,
      lines: Map<string, { inflows: number; outflows: number }>,
    ): CashFlowSection => {
      const lineItems: CashFlowLine[] = [];
      let totalInflows = 0;
      let totalOutflows = 0;

      for (const [labelKey, values] of lines) {
        if (values.inflows === 0 && values.outflows === 0) continue;
        lineItems.push({
          label: labelKey,
          inflows: values.inflows,
          outflows: values.outflows,
          net: values.inflows - values.outflows,
        });
        totalInflows += values.inflows;
        totalOutflows += values.outflows;
      }

      return {
        label,
        lines: lineItems,
        totalInflows,
        totalOutflows,
        net: totalInflows - totalOutflows,
      };
    };

    const operating = buildSection("Operating Activities", operatingLines);
    const investing = buildSection("Investing Activities", investingLines);
    const financing = buildSection("Financing Activities", financingLines);

    const netCashChange = operating.net + investing.net + financing.net;

    // Compute beginning cash (sum of all cash account balances before dateFrom)
    const [beginningRow] = await db
      .select({
        balance:
          sql<number>`coalesce(sum(${journalLines.debit}::numeric) - sum(${journalLines.credit}::numeric), 0)`.as(
            "balance",
          ),
      })
      .from(journalLines)
      .innerJoin(ledgerAccounts, eq(journalLines.accountId, ledgerAccounts.id))
      .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .where(
        and(
          lte(journalEntries.entryDate, dateFrom),
          eq(journalEntries.isReversed, false),
          sql`${ledgerAccounts.code} IN (${sql.join(
            CASH_ACCOUNTS.map((c) => sql`${c}`),
            sql`, `,
          )})`,
        ),
      );

    const beginningCash = Math.round(Number(beginningRow?.balance ?? 0));
    const endingCash = beginningCash + netCashChange;

    return successResponse({
      operating,
      investing,
      financing,
      netCashFromOperating: operating.net,
      netCashFromInvesting: investing.net,
      netCashFromFinancing: financing.net,
      netCashChange,
      beginningCash,
      endingCash,
      dateFrom: dateFrom.toISOString(),
      dateTo: dateTo.toISOString(),
    });
  } catch (error) {
    return handleActionError(error, "getCashFlowStatement", "Failed to fetch cash flow statement");
  }
}
