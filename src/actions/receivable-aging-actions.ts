"use server";

import { format, startOfDay } from "date-fns";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { requireFinanceAccess } from "@/lib/auth/validate";
import { db } from "@/lib/db";
import { customers, projectPayments, projects } from "@/lib/db/schema";
import type { ProjectStatus } from "@/lib/domain/enums";
import { type ActionResponse, successResponse } from "@/lib/utils/action-response";
import { handleActionError } from "@/lib/utils/error";

export interface ReceivableAgingBucket {
  projectId: string;
  projectNumber: string;
  customerName: string;
  outstanding: number;
  current: number;
  days31to60: number;
  days61to90: number;
  days91to120: number;
  days120Plus: number;
  completionDate: string | null;
  status: ProjectStatus;
}

export interface ReceivableAgingSummary {
  totalOutstanding: number;
  current: number;
  days31to60: number;
  days61to90: number;
  days91to120: number;
  days120Plus: number;
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
        createdAt: projects.createdAt,
        paidAmount: sql<string>`coalesce(sum(${projectPayments.amount}::numeric), 0)`.as(
          "paid_amount",
        ),
      })
      .from(projects)
      .innerJoin(customers, eq(projects.customerId, customers.id))
      .leftJoin(projectPayments, eq(projectPayments.projectId, projects.id))
      .where(
        inArray(projects.status, [
          "planning",
          "in_progress",
          "on_hold",
          "installation_completed",
          "completed",
        ]),
      )
      .groupBy(
        projects.id,
        projects.projectNumber,
        customers.name,
        projects.quotedTotal,
        projects.status,
        projects.actualCompletion,
        projects.createdAt,
      )
      .orderBy(desc(projects.actualCompletion));

    const buckets: ReceivableAgingBucket[] = [];
    let summaryTotal = 0;
    let summaryCurrent = 0;
    let summary31to60 = 0;
    let summary61to90 = 0;
    let summary91to120 = 0;
    let summary120Plus = 0;

    for (const row of rows) {
      const quoted = Math.round(Number(row.quotedTotal));
      const paid = Math.round(Number(row.paidAmount));
      const outstanding = quoted - paid;

      if (outstanding <= 0) continue;

      let daysSinceCompletion = 0;
      const baseDate = row.actualCompletion || row.createdAt;
      if (baseDate) {
        const completionDate = new Date(baseDate);
        daysSinceCompletion = Math.floor(
          (now.getTime() - completionDate.getTime()) / (1000 * 60 * 60 * 24),
        );
      }

      let current = 0;
      let days31to60 = 0;
      let days61to90 = 0;
      let days91to120 = 0;
      let days120Plus = 0;

      if (daysSinceCompletion <= 30) {
        current = outstanding;
      } else if (daysSinceCompletion <= 60) {
        days31to60 = outstanding;
      } else if (daysSinceCompletion <= 90) {
        days61to90 = outstanding;
      } else if (daysSinceCompletion <= 120) {
        days91to120 = outstanding;
      } else {
        days120Plus = outstanding;
      }

      summaryTotal += outstanding;
      summaryCurrent += current;
      summary31to60 += days31to60;
      summary61to90 += days61to90;
      summary91to120 += days91to120;
      summary120Plus += days120Plus;

      buckets.push({
        projectId: row.projectId,
        projectNumber: row.projectNumber,
        customerName: row.customerName ?? "Unknown",
        outstanding,
        current,
        days31to60,
        days61to90,
        days91to120,
        days120Plus,
        completionDate: row.actualCompletion
          ? format(new Date(row.actualCompletion), "yyyy-MM-dd")
          : null,
        status: row.status as ProjectStatus,
      });
    }

    buckets.sort((a, b) => b.outstanding - a.outstanding);

    return successResponse({
      asOfDate: format(now, "yyyy-MM-dd"),
      summary: {
        totalOutstanding: summaryTotal,
        current: summaryCurrent,
        days31to60: summary31to60,
        days61to90: summary61to90,
        days91to120: summary91to120,
        days120Plus: summary120Plus,
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
