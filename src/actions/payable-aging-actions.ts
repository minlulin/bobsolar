"use server";

import { format, startOfDay } from "date-fns";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { requireFinanceAccess } from "@/lib/auth/validate";
import { db } from "@/lib/db";
import { purchaseOrders, suppliers } from "@/lib/db/schema";
import { type ActionResponse, successResponse } from "@/lib/utils/action-response";
import { handleActionError } from "@/lib/utils/error";

export interface PayableAgingBucket {
  poId: string;
  poNumber: string;
  supplierName: string;
  companyName: string | null;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  current: number;
  days31to60: number;
  days61to90: number;
  days91to120: number;
  days120Plus: number;
  createdAt: string;
  status: string;
}

export interface PayableAgingSummary {
  totalOutstanding: number;
  current: number;
  days31to60: number;
  days61to90: number;
  days91to120: number;
  days120Plus: number;
  poCount: number;
}

export interface PayableAgingReport {
  asOfDate: string;
  summary: PayableAgingSummary;
  buckets: PayableAgingBucket[];
}

export async function getPayableAgingReport(): Promise<ActionResponse<PayableAgingReport>> {
  try {
    await requireFinanceAccess();

    const now = startOfDay(new Date());

    const rows = await db
      .select({
        poId: purchaseOrders.id,
        poNumber: purchaseOrders.poNumber,
        supplierName: suppliers.name,
        companyName: suppliers.companyName,
        totalAmount: purchaseOrders.totalAmount,
        paidAmount: purchaseOrders.paidAmount,
        balanceDue: purchaseOrders.balanceDue,
        status: purchaseOrders.status,
        createdAt: purchaseOrders.createdAt,
        dueDate: purchaseOrders.dueDate,
      })
      .from(purchaseOrders)
      .innerJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .where(and(gte(purchaseOrders.balanceDue, sql`0.01`), eq(purchaseOrders.status, "received")))
      .orderBy(desc(purchaseOrders.createdAt));

    const buckets: PayableAgingBucket[] = [];
    let summaryTotal = 0;
    let summaryCurrent = 0;
    let summary31to60 = 0;
    let summary61to90 = 0;
    let summary91to120 = 0;
    let summary120Plus = 0;

    for (const row of rows) {
      const balance = Math.round(Number(row.balanceDue));
      if (balance <= 0) continue;

      const createdAt = new Date(row.createdAt);
      const referenceDate = row.dueDate ? new Date(row.dueDate) : createdAt;
      const daysSinceCreation = Math.floor(
        (now.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      let current = 0;
      let days31to60 = 0;
      let days61to90 = 0;
      let days91to120 = 0;
      let days120Plus = 0;

      if (daysSinceCreation <= 30) {
        current = balance;
      } else if (daysSinceCreation <= 60) {
        days31to60 = balance;
      } else if (daysSinceCreation <= 90) {
        days61to90 = balance;
      } else if (daysSinceCreation <= 120) {
        days91to120 = balance;
      } else {
        days120Plus = balance;
      }

      summaryTotal += balance;
      summaryCurrent += current;
      summary31to60 += days31to60;
      summary61to90 += days61to90;
      summary91to120 += days91to120;
      summary120Plus += days120Plus;

      buckets.push({
        poId: row.poId,
        poNumber: row.poNumber,
        supplierName: row.supplierName,
        companyName: row.companyName,
        totalAmount: Math.round(Number(row.totalAmount)),
        paidAmount: Math.round(Number(row.paidAmount)),
        balanceDue: balance,
        current,
        days31to60,
        days61to90,
        days91to120,
        days120Plus,
        createdAt: format(createdAt, "yyyy-MM-dd"),
        status: row.status,
      });
    }

    buckets.sort((a, b) => b.balanceDue - a.balanceDue);

    return successResponse({
      asOfDate: format(now, "yyyy-MM-dd"),
      summary: {
        totalOutstanding: summaryTotal,
        current: summaryCurrent,
        days31to60: summary31to60,
        days61to90: summary61to90,
        days91to120: summary91to120,
        days120Plus: summary120Plus,
        poCount: buckets.length,
      },
      buckets,
    });
  } catch (error) {
    return handleActionError(
      error,
      "getPayableAgingReport",
      "Failed to fetch payable aging report",
    );
  }
}
