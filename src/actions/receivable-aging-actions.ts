"use server";

import { format, startOfDay } from "date-fns";
import { desc, eq, sql } from "drizzle-orm";
import { requireFinanceAccess } from "@/lib/auth/validate";
import { db } from "@/lib/db";
import { customers, projectPayments, projects } from "@/lib/db/schema";
import { type ActionResponse, successResponse } from "@/lib/utils/action-response";
import { handleActionError } from "@/lib/utils/error";

export interface ReceivableAgingBucket {
  projectId: string;
  projectNumber: string;
  customerName: string;
  outstanding: number;
  current: number;
  days30: number;
  days60: number;
  days90: number;
  days90Plus: number;
  completionDate: string | null;
  status: string;
}

export interface ReceivableAgingSummary {
  totalOutstanding: number;
  current: number;
  days30: number;
  days60: number;
  days90: number;
  days90Plus: number;
  projectCount: number;
}

export interface ReceivableAgingReport {
  asOfDate: string;
  summary: ReceivableAgingSummary;
  buckets: ReceivableAgingBucket[];
}

export async function getReceivableAgingReport(): Promise<ActionResponse<ReceivableAgingReport>> {
  try {
    await requireFinanceAccess();

    const now = startOfDay(new Date());

    const rows = await db
      .select({
        projectId: projects.id,
        projectNumber: projects.projectNumber,
        customerName: customers.name,
        quotedTotal: projects.quotedTotal,
        status: projects.status,
        actualCompletion: projects.actualCompletion,
        paidAmount: sql<string>`coalesce(sum(${projectPayments.amount}::numeric), 0)`.as(
          "paid_amount",
        ),
      })
      .from(projects)
      .innerJoin(customers, eq(projects.customerId, customers.id))
      .leftJoin(projectPayments, eq(projectPayments.projectId, projects.id))
      .where(eq(projects.status, "completed"))
      .groupBy(
        projects.id,
        projects.projectNumber,
        customers.name,
        projects.quotedTotal,
        projects.status,
        projects.actualCompletion,
      )
      .orderBy(desc(projects.actualCompletion));

    const buckets: ReceivableAgingBucket[] = [];
    let summaryTotal = 0;
    let summaryCurrent = 0;
    let summary30 = 0;
    let summary60 = 0;
    let summary90 = 0;
    let summary90Plus = 0;

    for (const row of rows) {
      const quoted = Math.round(Number(row.quotedTotal));
      const paid = Math.round(Number(row.paidAmount));
      const outstanding = quoted - paid;

      if (outstanding <= 0) continue;

      let daysSinceCompletion = 0;
      if (row.actualCompletion) {
        const completionDate = new Date(row.actualCompletion);
        daysSinceCompletion = Math.floor(
          (now.getTime() - completionDate.getTime()) / (1000 * 60 * 60 * 24),
        );
      }

      let current = 0;
      let days30 = 0;
      let days60 = 0;
      let days90 = 0;
      let days90Plus = 0;

      if (daysSinceCompletion <= 30) {
        current = outstanding;
      } else if (daysSinceCompletion <= 60) {
        days30 = outstanding;
      } else if (daysSinceCompletion <= 90) {
        days60 = outstanding;
      } else if (daysSinceCompletion <= 120) {
        days90 = outstanding;
      } else {
        days90Plus = outstanding;
      }

      summaryTotal += outstanding;
      summaryCurrent += current;
      summary30 += days30;
      summary60 += days60;
      summary90 += days90;
      summary90Plus += days90Plus;

      buckets.push({
        projectId: row.projectId,
        projectNumber: row.projectNumber,
        customerName: row.customerName ?? "Unknown",
        outstanding,
        current,
        days30,
        days60,
        days90,
        days90Plus,
        completionDate: row.actualCompletion
          ? format(new Date(row.actualCompletion), "yyyy-MM-dd")
          : null,
        status: row.status,
      });
    }

    buckets.sort((a, b) => b.outstanding - a.outstanding);

    return successResponse({
      asOfDate: format(now, "yyyy-MM-dd"),
      summary: {
        totalOutstanding: summaryTotal,
        current: summaryCurrent,
        days30: summary30,
        days60: summary60,
        days90: summary90,
        days90Plus: summary90Plus,
        projectCount: buckets.length,
      },
      buckets,
    });
  } catch (error) {
    return handleActionError(
      error,
      "getReceivableAgingReport",
      "Failed to fetch receivable aging report",
    );
  }
}
