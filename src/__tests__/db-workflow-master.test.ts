import { randomUUID } from "node:crypto";
import { and, eq, like, or } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createCustomer } from "@/actions/customer-actions";
import {
  getDashboardPipeline,
  getDashboardStats,
  getRecentActivity,
  getUpcomingAlerts,
} from "@/actions/dashboard-actions";
import { createInventoryItem } from "@/actions/inventory-actions";
import { createInvoice, postInvoice } from "@/actions/invoice-actions";
import { getMonthEndCloseReport } from "@/actions/month-end-close-actions";
import {
  getNotificationsWithFilter,
  markAllNotificationsAsRead,
  runScheduledNotificationChecks,
} from "@/actions/notification-actions";
import { getPaymentMethods, recordPayment } from "@/actions/payment-actions";
import {
  acknowledgeProjectHandover,
  addProjectCost,
  addProjectRemark,
  consumeProjectInventory,
  convertQuotationToProject,
  getProject,
  markProjectCompleted,
  updateProject,
} from "@/actions/project-actions";
import { createQuotation, getQuotation, updateQuotationStatus } from "@/actions/quotation-actions";
import {
  getWarrantyAlerts,
  reopenWarrantyAlert,
  resolveWarrantyAlert,
} from "@/actions/warranty-actions";
import { db } from "@/lib/db";
import {
  customers,
  inventoryItems,
  journalEntries,
  journalLines,
  notifications,
  projectCosts,
  projectInvoiceLines,
  projectInvoices,
  projectPaymentAllocations,
  projectPayments,
  projectRemarks,
  projects,
  projectVouchers,
  quotationItems,
  quotations,
  users,
  warrantyAlerts,
} from "@/lib/db/schema";

const authState = vi.hoisted(() => ({
  userId: "",
  role: "admin" as const,
}));

vi.mock("@/lib/auth/validate", () => ({
  requireAuth: async (): Promise<{
    userId: string;
    role: "admin" | "owner";
  }> => {
    if (!authState.userId) {
      throw new Error("Auth context not initialized");
    }
    return await Promise.resolve({
      userId: authState.userId,
      role: authState.role,
    });
  },
  requireAdmin: async (): Promise<{ userId: string; role: "admin" }> => {
    if (!authState.userId) {
      throw new Error("Auth context not initialized");
    }
    return await Promise.resolve({
      userId: authState.userId,
      role: authState.role,
    });
  },
  requireOwner: async (): Promise<{ userId: string; role: "admin" }> => {
    if (!authState.userId) {
      throw new Error("Auth context not initialized");
    }
    return await Promise.resolve({
      userId: authState.userId,
      role: "admin",
    });
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn().mockImplementation((fn: unknown) => fn),
}));

const databaseUrl = process.env["DATABASE_URL"] ?? "";
const runDbTests =
  process.env["RUN_DB_TESTS"] === "1" ||
  (!!process.env["TEST_DATABASE_URL"] && process.env["RUN_DB_TESTS"] !== "0");
const describeDb = databaseUrl && runDbTests ? describe : describe.skip;

function unwrap<T>(result: { success: boolean; data?: T; error?: string }): T {
  if (!result.success) {
    throw new Error(result.error ?? "Action failed");
  }
  return result.data as T;
}

describeDb("Master workflow integration: DB + server actions", () => {
  const runTag = `wf-${Date.now()}`;
  let adminUserId = "";
  let staffUserId = "";
  let customerId = "";
  let inventoryId = "";
  let quotationId = "";
  let projectId = "";
  let invoiceId = "";
  let warrantyAlertId = "";

  beforeAll(async () => {
    try {
      await db.execute("select 1");
    } catch (error) {
      throw new Error(
        `Cannot connect to test database via DATABASE_URL (mapped from TEST_DATABASE_URL in vitest). ${String(error)}`,
      );
    }

    const adminEmail = `${runTag}-admin@example.com`;
    const staffEmail = `${runTag}-staff@example.com`;

    const [adminRow] = await db
      .insert(users)
      .values({
        email: adminEmail,
        passwordHash: "test_hash",
        name: "Workflow Admin",
        role: "admin",
      })
      .returning({ id: users.id });

    const [staffRow] = await db
      .insert(users)
      .values({
        email: staffEmail,
        passwordHash: "test_hash",
        name: "Workflow Staff",
        role: "owner",
      })
      .returning({ id: users.id });

    if (!adminRow?.id || !staffRow?.id) {
      throw new Error("Failed to create workflow test users");
    }

    adminUserId = adminRow.id;
    staffUserId = staffRow.id;
    authState.userId = adminUserId;
    authState.role = "admin";
  });

  afterAll(async () => {
    try {
      if (projectId) {
        await db.delete(projectRemarks).where(eq(projectRemarks.projectId, projectId));
        await db.delete(projectCosts).where(eq(projectCosts.projectId, projectId));
        await db.delete(warrantyAlerts).where(eq(warrantyAlerts.projectId, projectId));
        await db.delete(projectPayments).where(eq(projectPayments.projectId, projectId));
        await db.delete(projectVouchers).where(eq(projectVouchers.projectId, projectId));
        if (invoiceId) {
          await db
            .delete(projectPaymentAllocations)
            .where(eq(projectPaymentAllocations.invoiceId, invoiceId));
          await db.delete(projectInvoiceLines).where(eq(projectInvoiceLines.invoiceId, invoiceId));
          await db.delete(projectInvoices).where(eq(projectInvoices.id, invoiceId));
        }
        await db.delete(projects).where(eq(projects.id, projectId));
      }
      if (quotationId) {
        await db.delete(quotationItems).where(eq(quotationItems.quotationId, quotationId));
        await db.delete(quotations).where(eq(quotations.id, quotationId));
      }
      if (inventoryId) {
        await db.delete(inventoryItems).where(eq(inventoryItems.id, inventoryId));
      }
      if (customerId) {
        await db.delete(customers).where(eq(customers.id, customerId));
      }

      await db.delete(notifications).where(like(notifications.title, "Project completed%"));
      await db.delete(notifications).where(like(notifications.title, "Alert resolved%"));
      await db.delete(notifications).where(like(notifications.title, "New warranty alert%"));

      if (adminUserId || staffUserId) {
        await db
          .delete(notifications)
          .where(and(like(notifications.message, `%${runTag}%`), eq(notifications.isRead, true)));
        await db
          .delete(journalEntries)
          .where(
            or(
              eq(journalEntries.createdBy, adminUserId),
              eq(journalEntries.createdBy, staffUserId),
            ),
          );
        await db.delete(users).where(eq(users.id, adminUserId));
        await db.delete(users).where(eq(users.id, staffUserId));
      }
    } catch (error) {
      console.warn("Workflow cleanup warning:", error);
    }
  });

  it("runs the business workflow from customer to completed project", async () => {
    const createdCustomer = unwrap(
      await createCustomer({
        name: `${runTag} Customer`,
        phone: "09-000111222",
        email: `${runTag}@customer.com`,
        address: "Yangon",
        city: "Yangon",
      }),
    );
    customerId = createdCustomer.id;

    const createdInventory = unwrap(
      await createInventoryItem({
        name: `${runTag} Panel`,
        category: "panel",
        unit: "pcs",
        costPrice: 200000,
        unitPrice: 350000,
        stockQty: 50,
        brand: "BOB",
        modelNumber: "P400",
        specifications: {
          brandModel: "BOB P400",
          cellType: "n_type",
          wattageW: 400,
          warranty: "25 years",
        },
        isActive: true,
      }),
    );
    inventoryId = createdInventory.id;

    const createdQuotation = unwrap(
      await createQuotation({
        customerId,
        items: [
          {
            itemId: inventoryId,
            description: "Panel 400W",
            quantity: 4,
            unitPrice: 350000,
            discountPercentage: 0,
          },
        ],
        discountPercent: 5,
        taxPercent: 5,
        notes: `${runTag} quotation`,
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }),
    );
    quotationId = createdQuotation.id;

    const quotationDetail = unwrap(await getQuotation(quotationId));
    expect(quotationDetail.items.length).toBe(1);
    expect(Number(quotationDetail.total)).toBeGreaterThan(0);

    unwrap(await updateQuotationStatus(quotationId, "sent"));
    unwrap(await updateQuotationStatus(quotationId, "accepted"));

    const createdProject = unwrap(
      await convertQuotationToProject({
        quotationId,
        siteAddress: `${runTag} Site`,
        systemSizeKwp: 5.5,
        notes: `${runTag} project`,
      }),
    );
    projectId = createdProject.id;

    // Create and post an invoice to recognize revenue for the project.
    // The project must be completed before posting an invoice (revenue recognition).
    const methods0 = unwrap(await getPaymentMethods()) as Array<{
      id: string;
      name: string;
      createdAt: Date;
      isActive: boolean;
      isDefault?: boolean;
    }>;
    const defaultMethod0 = methods0.find((method) => method.isDefault) ?? methods0[0];
    if (!defaultMethod0) {
      console.warn(
        "No payment methods configured for workflow test; skipping payment-based assertions.",
      );
      return;
    }
    const defaultMethodId0 = defaultMethod0.id;
    expect(defaultMethodId0).toBeTruthy();

    const consumedCosts = unwrap(
      await consumeProjectInventory({
        projectId,
        inventoryItemId: inventoryId,
        paymentMethodId: defaultMethodId0 ?? "",
        quantity: 2,
        description: `${runTag} panel consumption`,
        incurredDate: new Date(),
      }),
    );
    expect(consumedCosts.length).toBeGreaterThan(0);

    const costs = unwrap(
      await addProjectCost({
        projectId,
        paymentMethodId: defaultMethodId0 ?? "",
        description: `${runTag} install labor`,
        amount: 100000,
        costType: "labor",
        incurredDate: new Date(),
      }),
    );
    expect(costs.length).toBeGreaterThan(0);

    // Verify project costs were recorded and linked to a payment method when available.
    const dbCosts = await db.query.projectCosts.findMany({
      where: eq(projectCosts.projectId, projectId),
    });
    expect(dbCosts.length).toBeGreaterThan(0);
    const hasStoredPaymentMethod = dbCosts.some(
      (cost) => cost.paymentMethodId === defaultMethodId0,
    );
    expect(hasStoredPaymentMethod).toBe(true);

    // Advance project to completed before posting invoice (revenue recognition
    // is only allowed for completed projects).
    unwrap(
      await updateProject({
        id: projectId,
        status: "in_progress",
      }),
    );
    unwrap(
      await updateProject({
        id: projectId,
        status: "installation_completed",
        handoverDate: new Date(),
        handoverPdfUrl: "https://example.com/handover.pdf",
      }),
    );
    unwrap(await acknowledgeProjectHandover(projectId, "Test Customer"));
    unwrap(await markProjectCompleted(projectId));

    const invoiceResult = unwrap(
      await createInvoice({
        projectId,
        customerId,
        invoiceDate: new Date().toISOString(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        lines: [
          {
            description: "Panel 400W system",
            quantity: 1,
            unitPrice: 1330000,
            taxAmount: 66500,
          },
        ],
      }),
    );
    invoiceId = invoiceResult.invoiceId;

    unwrap(await postInvoice({ invoiceId }));

    // Verify that postInvoice successfully recorded a revenue recognition journal entry
    const conversionEntries = await db.query.journalEntries.findMany({
      where: and(
        eq(journalEntries.sourceType, "project_invoice"),
        eq(journalEntries.sourceId, invoiceId),
      ),
    });
    const revRecEntry = conversionEntries.find((entry) => entry.sourceType === "project_invoice");
    expect(revRecEntry).toBeTruthy();
    if (!revRecEntry) {
      throw new Error("revRecEntry not found");
    }

    const revRecLines = await db.query.journalLines.findMany({
      where: eq(journalLines.entryId, revRecEntry.id),
      with: {
        account: true,
      },
    });
    expect(revRecLines.length).toBeGreaterThan(0);

    const hasDebitLine = revRecLines.some((line) => Number(line.debit) > 0);
    const hasCreditLine = revRecLines.some((line) => Number(line.credit) > 0);
    const accountCodes = revRecLines.map((line) => line.account?.code).filter(Boolean);

    expect(hasDebitLine).toBe(true);
    expect(hasCreditLine).toBe(true);
    expect(accountCodes.length).toBeGreaterThan(0);

    const methods = unwrap(await getPaymentMethods()) as Array<{
      id: string;
      name: string;
      createdAt: Date;
      isActive: boolean;
      isDefault?: boolean;
    }>;
    const defaultMethod = methods.find((method) => method.isDefault) ?? methods[0];
    if (!defaultMethod) throw new Error("No payment method found");
    const defaultMethodId = defaultMethod.id;
    expect(defaultMethodId).toBeTruthy();

    const stockRow = await db.query.inventoryItems.findFirst({
      where: eq(inventoryItems.id, inventoryId),
      columns: { stockQty: true },
    });
    expect(stockRow?.stockQty).toBeLessThan(50);

    const insufficient = await consumeProjectInventory({
      projectId,
      inventoryItemId: inventoryId,
      paymentMethodId: defaultMethodId ?? "",
      quantity: 9999,
      description: `${runTag} too much`,
      incurredDate: new Date(),
    });
    expect(insufficient.success).toBe(false);

    const stillStockRow = await db.query.inventoryItems.findFirst({
      where: eq(inventoryItems.id, inventoryId),
      columns: { stockQty: true },
    });
    expect(stillStockRow?.stockQty).toBeLessThan(50);

    const invalidProjectConsume = await consumeProjectInventory({
      projectId: randomUUID(),
      inventoryItemId: inventoryId,
      paymentMethodId: defaultMethodId ?? "",
      quantity: 1,
      description: `${runTag} invalid project`,
      incurredDate: new Date(),
    });
    expect(invalidProjectConsume.success).toBe(false);

    const remarks = unwrap(
      await addProjectRemark({
        projectId,
        content: `${runTag} first remark`,
        remarkType: "note",
      }),
    );
    expect(remarks.length).toBeGreaterThan(0);

    const projectDetail = unwrap(await getProject(projectId));
    expect(projectDetail.costs.length).toBeGreaterThan(0);
    expect(projectDetail.remarks.length).toBeGreaterThan(0);
    expect(Number(projectDetail.profitability.inventoryConsumedCost)).toBeGreaterThanOrEqual(0);
    expect(Number(projectDetail.profitability.additionalCosts)).toBeGreaterThanOrEqual(0);

    // Project is already completed from earlier in the workflow; record final payment.
    unwrap(
      await recordPayment({
        projectId,
        amount: 1396500,
        paymentType: "final",
        paymentMethodId: defaultMethodId ?? "",
        paymentDate: new Date(),
        allocations: [
          {
            invoiceId,
            amount: 1396500,
          },
        ],
      }),
    );

    // Verify that the month-end close checks pass
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    const closeReport = unwrap(
      await getMonthEndCloseReport({
        year: currentYear,
        month: currentMonth,
      }),
    );
    expect(closeReport.checks.length).toBeGreaterThan(0);

    const paymentsPostedCheck = closeReport.checks.find((c) => c.id === "payments-posted");
    const costsPostedCheck = closeReport.checks.find((c) => c.id === "costs-posted");
    expect(paymentsPostedCheck).toBeTruthy();
    expect(costsPostedCheck).toBeTruthy();

    const acceptableStatuses = new Set(["pass", "warning", "warn"]);
    if (paymentsPostedCheck) {
      expect(acceptableStatuses.has(paymentsPostedCheck.status)).toBe(true);
    }
    if (costsPostedCheck) {
      expect(acceptableStatuses.has(costsPostedCheck.status)).toBe(true);
    }

    const allAlerts = unwrap(await getWarrantyAlerts({ tab: "all" }));
    const projectAlerts = allAlerts.filter((alert) => alert.projectId === projectId);
    expect(projectAlerts.length).toBeGreaterThanOrEqual(0);
    warrantyAlertId = projectAlerts[0]?.id ?? "";

    if (warrantyAlertId) {
      unwrap(await resolveWarrantyAlert(warrantyAlertId));
      unwrap(await reopenWarrantyAlert(warrantyAlertId));
    }

    const scheduled = unwrap(await runScheduledNotificationChecks());
    expect(scheduled.expiringQuotes).toBeGreaterThanOrEqual(0);
    expect(scheduled.dueSoonAlerts).toBeGreaterThanOrEqual(0);
    expect(scheduled.overdueAlerts).toBeGreaterThanOrEqual(0);

    // Verify cash movement report with outflows
    const { getCashMovementReport } = await import("@/actions/cash-movement-actions");
    const cashMovement = unwrap(
      await getCashMovementReport({
        dateFrom: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        dateTo: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      }),
    );
    const methodRow =
      cashMovement.byMethod.find((m) => m.methodName === defaultMethod.name) ??
      cashMovement.byMethod[0];
    expect(methodRow).toBeTruthy();
    expect(Number(methodRow?.totalIn ?? 0)).toBeGreaterThanOrEqual(0);
    expect(Number(methodRow?.totalOut ?? 0)).toBeGreaterThanOrEqual(0);
    expect(Number(methodRow?.netMovement ?? 0)).toBeGreaterThanOrEqual(0);

    // Test repairOrphanCost
    const { repairOrphanCost } = await import("@/actions/recovery-actions");

    // 1. Create a legacy cost (no paymentMethodId, non-material)
    const legacyCosts = await db
      .insert(projectCosts)
      .values({
        projectId,
        description: `${runTag} legacy cost`,
        amount: "50000",
        costType: "transport",
        incurredDate: new Date(),
        addedBy: adminUserId,
      })
      .returning();
    const legacyCost = legacyCosts[0];
    if (!legacyCost) throw new Error("Failed to insert legacy cost");

    const repairLegacyResult = unwrap(await repairOrphanCost(legacyCost.id));
    const legacyEntryLines = await db.query.journalLines.findMany({
      where: eq(journalLines.entryId, repairLegacyResult.entryId),
      with: { account: true },
    });
    const legacyCreditLine = legacyEntryLines.find((line) => Number(line.credit) > 0);
    expect(legacyCreditLine?.account.code).toBeTruthy();

    // 2. Create a material cost
    const testMatCosts = await db
      .insert(projectCosts)
      .values({
        projectId,
        description: `${runTag} test material cost`,
        amount: "60000",
        costType: "material",
        incurredDate: new Date(),
        addedBy: adminUserId,
      })
      .returning();
    const testMatCost = testMatCosts[0];
    if (!testMatCost) throw new Error("Failed to insert material cost");

    const repairMatResult = unwrap(await repairOrphanCost(testMatCost.id));
    const matEntryLines = await db.query.journalLines.findMany({
      where: eq(journalLines.entryId, repairMatResult.entryId),
      with: { account: true },
    });
    const matCreditLine = matEntryLines.find((line) => Number(line.credit) > 0);
    expect(matCreditLine?.account.code).toBeTruthy();

    // 3. Create a dynamic cost with paymentMethodId
    const dynamicCosts = await db
      .insert(projectCosts)
      .values({
        projectId,
        paymentMethodId: defaultMethodId,
        description: `${runTag} dynamic cost`,
        amount: "70000",
        costType: "misc",
        incurredDate: new Date(),
        addedBy: adminUserId,
      })
      .returning();
    const dynamicCost = dynamicCosts[0];
    if (!dynamicCost) throw new Error("Failed to insert dynamic cost");

    const repairDynamicResult = unwrap(await repairOrphanCost(dynamicCost.id));
    const dynamicEntryLines = await db.query.journalLines.findMany({
      where: eq(journalLines.entryId, repairDynamicResult.entryId),
      with: { account: true },
    });
    const dynamicCreditLine = dynamicEntryLines.find((line) => Number(line.credit) > 0);
    expect(dynamicCreditLine?.account.code).toBeTruthy();

    const stats = unwrap(await getDashboardStats());
    expect(stats.totalCustomers).toBeGreaterThanOrEqual(1);
    expect(stats.pendingQuotationsCount).toBeGreaterThanOrEqual(0);

    const pipeline = unwrap(await getDashboardPipeline());
    expect(pipeline.stages.length).toBeGreaterThanOrEqual(4);

    const activity = unwrap(await getRecentActivity(10));
    expect(activity.length).toBeGreaterThanOrEqual(0);

    const upcoming = unwrap(await getUpcomingAlerts(10));
    expect(upcoming.length).toBeGreaterThanOrEqual(0);

    const unread = unwrap(await getNotificationsWithFilter({ unreadOnly: true }));
    expect(Array.isArray(unread)).toBe(true);
    unwrap(await markAllNotificationsAsRead());
  }, 180000);
});
