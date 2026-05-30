"use server";

import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { requireFinanceAccess } from "@/lib/auth/validate";
import { db } from "@/lib/db";
import {
  customers,
  journalEntries,
  journalLines,
  ledgerAccounts,
  projectPayments,
  projects,
} from "@/lib/db/schema";
import { type ActionResponse, successResponse } from "@/lib/utils/action-response";
import { handleActionError } from "@/lib/utils/error";

const projectProfitabilityFilterSchema = z.object({
  status: z.enum(["completed", "all"]).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export interface ProjectProfitabilityRow {
  projectId: string;
  projectNumber: string;
  customerName: string;
  status: string;
  quotedTotal: number;
  totalRevenue: number;
  totalCogs: number;
  totalExpenses: number;
  grossProfit: number;
  netProfit: number;
  grossMargin: number;
  netMargin: number;
  paidAmount: number;
  outstanding: number;
}

export interface ProjectProfitabilitySummary {
  totalRevenue: number;
  totalCogs: number;
  totalExpenses: number;
  totalNetProfit: number;
  averageMargin: number;
  projectCount: number;
}

export interface ProjectProfitabilityReport {
  summary: ProjectProfitabilitySummary;
  projects: ProjectProfitabilityRow[];
}

export async function getProjectProfitabilityReport(
  rawFilters: unknown = {},
): Promise<ActionResponse<ProjectProfitabilityReport>> {
  try {
    await requireFinanceAccess();

    const filters = projectProfitabilityFilterSchema.parse(rawFilters);

    const statusFilter =
      filters.status === "completed"
        ? eq(projects.status, "completed")
        : inArray(projects.status, ["completed", "installation_completed", "in_progress"]);

    const dateFrom = filters.dateFrom ? new Date(filters.dateFrom) : undefined;
    const dateTo = filters.dateTo ? new Date(filters.dateTo) : undefined;

    const projectRows = await db
      .select({
        projectId: projects.id,
        projectNumber: projects.projectNumber,
        customerName: customers.name,
        status: projects.status,
        quotedTotal: projects.quotedTotal,
      })
      .from(projects)
      .innerJoin(customers, eq(projects.customerId, customers.id))
      .where(statusFilter)
      .orderBy(projects.projectNumber);

    const results: ProjectProfitabilityRow[] = [];
    let summaryRevenue = 0;
    let summaryCogs = 0;
    let summaryExpenses = 0;
    let summaryNetProfit = 0;

    const projectIds = projectRows.map((p) => p.projectId);

    const whereConditions = [eq(journalEntries.isReversed, false)];
    if (dateFrom) whereConditions.push(gte(journalEntries.entryDate, dateFrom));
    if (dateTo) whereConditions.push(lte(journalEntries.entryDate, dateTo));

    const journalData =
      projectIds.length > 0
        ? await db
            .select({
              projectId: journalLines.projectId,
              totalRevenue:
                sql<number>`coalesce(sum(case when ${ledgerAccounts.type} = 'income' then ${journalLines.credit}::numeric - ${journalLines.debit}::numeric else 0 end), 0)`.as(
                  "totalRevenue",
                ),
              totalCogs:
                sql<number>`coalesce(sum(case when ${ledgerAccounts.code} = 'cost_of_goods_sold' then ${journalLines.debit}::numeric - ${journalLines.credit}::numeric else 0 end), 0)`.as(
                  "totalCogs",
                ),
              totalExpenses:
                sql<number>`coalesce(sum(case when ${ledgerAccounts.type} = 'expense' and ${ledgerAccounts.code} != 'cost_of_goods_sold' then ${journalLines.debit}::numeric - ${journalLines.credit}::numeric else 0 end), 0)`.as(
                  "totalExpenses",
                ),
            })
            .from(journalLines)
            .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
            .innerJoin(ledgerAccounts, eq(journalLines.accountId, ledgerAccounts.id))
            .where(and(...whereConditions, inArray(journalLines.projectId, projectIds)))
            .groupBy(journalLines.projectId)
        : [];

    const paymentData =
      projectIds.length > 0
        ? await db
            .select({
              projectId: projectPayments.projectId,
              paid: sql<number>`coalesce(sum(${projectPayments.amount}::numeric), 0)`.as("paid"),
            })
            .from(projectPayments)
            .where(inArray(projectPayments.projectId, projectIds))
            .groupBy(projectPayments.projectId)
        : [];

    const journalMap = new Map(journalData.map((d) => [d.projectId, d]));
    const paymentMap = new Map(paymentData.map((d) => [d.projectId, d]));

    for (const project of projectRows) {
      const quoted = Math.round(Number(project.quotedTotal));

      const journal = journalMap.get(project.projectId);
      const totalRevenue = Math.round(Number(journal?.totalRevenue ?? 0));
      const totalCogs = Math.round(Number(journal?.totalCogs ?? 0));
      const totalExpenses = Math.round(Number(journal?.totalExpenses ?? 0));

      const paymentRow = paymentMap.get(project.projectId);
      const paidAmount = Math.round(Number(paymentRow?.paid ?? 0));

      const grossProfit = totalRevenue - totalCogs;
      const netProfit = grossProfit - totalExpenses;
      const grossMargin = totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 100) : 0;
      const netMargin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;
      const outstanding = quoted - paidAmount;

      summaryRevenue += totalRevenue;
      summaryCogs += totalCogs;
      summaryExpenses += totalExpenses;
      summaryNetProfit += netProfit;

      results.push({
        projectId: project.projectId,
        projectNumber: project.projectNumber,
        customerName: project.customerName ?? "Unknown",
        status: project.status,
        quotedTotal: quoted,
        totalRevenue,
        totalCogs,
        totalExpenses,
        grossProfit,
        netProfit,
        grossMargin,
        netMargin,
        paidAmount,
        outstanding,
      });
    }

    // Sort by net profit descending
    results.sort((a, b) => b.netProfit - a.netProfit);

    const averageMargin =
      results.length > 0
        ? Math.round(results.reduce((sum, r) => sum + r.netMargin, 0) / results.length)
        : 0;

    return successResponse({
      summary: {
        totalRevenue: summaryRevenue,
        totalCogs: summaryCogs,
        totalExpenses: summaryExpenses,
        totalNetProfit: summaryNetProfit,
        averageMargin,
        projectCount: results.length,
      },
      projects: results,
    });
  } catch (error) {
    return handleActionError(
      error,
      "getProjectProfitabilityReport",
      "Failed to fetch project profitability report",
    );
  }
}
