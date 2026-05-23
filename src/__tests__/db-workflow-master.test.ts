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
import { getMonthEndCloseReport } from "@/actions/month-end-close-actions";
import {
  getNotificationsWithFilter,
  markAllNotificationsAsRead,
  runScheduledNotificationChecks,
} from "@/actions/notification-actions";
import { getPaymentMethods, recordPayment } from "@/actions/payment-actions";
import {
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
    role: "admin" | "staff";
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
  requireFinanceAccess: async (): Promise<{ userId: string; role: "admin" }> => {
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
const runDbTests = process.env["RUN_DB_TESTS"] === "1";
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
        role: "staff",
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
    if (projectId) {
      await db.delete(projectRemarks).where(eq(projectRemarks.projectId, projectId));
      await db.delete(projectCosts).where(eq(projectCosts.projectId, projectId));
      await db.delete(warrantyAlerts).where(eq(warrantyAlerts.projectId, projectId));
      await db.delete(projectPayments).where(eq(projectPayments.projectId, projectId));
      await db.delete(projectVouchers).where(eq(projectVouchers.projectId, projectId));
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
          or(eq(journalEntries.createdBy, adminUserId), eq(journalEntries.createdBy, staffUserId)),
        );
      await db.delete(users).where(eq(users.id, adminUserId));
      await db.delete(users).where(eq(users.id, staffUserId));
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

    // Verify that convertQuotationToProject successfully recorded a revenue recognition journal entry
    const conversionEntries = await db.query.journalEntries.findMany({
      where: and(
        eq(journalEntries.sourceType, "manual_adjustment"),
        eq(journalEntries.sourceId, projectId),
      ),
    });
    // We expect 1 manual_adjustment entry for revenue recognition
    const revRecEntry = conversionEntries.find((e) => e.sourceType === "manual_adjustment");
    expect(revRecEntry).toBeTruthy();
    if (!revRecEntry) {
      throw new Error("revRecEntry not found");
    }
    expect(revRecEntry.memo).toContain("Revenue recognition");

    // Fetch the lines for this entry
    const revRecLines = await db.query.journalLines.findMany({
      where: eq(journalLines.entryId, revRecEntry.id),
      with: {
        account: true,
      },
    });
    expect(revRecLines.length).toBe(2);

    const arLine = revRecLines.find((l) => l.account.code === "accounts_receivable");
    const revLine = revRecLines.find((l) => l.account.code === "solar_installation_revenue");

    expect(arLine).toBeTruthy();
    expect(Number(arLine?.debit)).toBe(Math.round(Number(quotationDetail.total)));
    expect(Number(arLine?.credit)).toBe(0);

    expect(revLine).toBeTruthy();
    expect(Number(revLine?.debit)).toBe(0);
    expect(Number(revLine?.credit)).toBe(Math.round(Number(quotationDetail.total)));

    const methods = unwrap(await getPaymentMethods());
    const defaultMethod = methods[0];
    if (!defaultMethod) throw new Error("No default payment method found");
    const defaultMethodId = defaultMethod.id;
    expect(defaultMethodId).toBeTruthy();

    const consumedCosts = unwrap(
      await consumeProjectInventory({
        projectId,
        inventoryItemId: inventoryId,
        paymentMethodId: defaultMethodId ?? "",
        quantity: 2,
        description: `${runTag} panel consumption`,
        incurredDate: new Date(),
      }),
    );
    expect(consumedCosts.length).toBeGreaterThan(0);

    const costs = unwrap(
      await addProjectCost({
        projectId,
        paymentMethodId: defaultMethodId ?? "",
        description: `${runTag} install labor`,
        amount: 100000,
        costType: "labor",
        incurredDate: new Date(),
      }),
    );
    expect(costs.length).toBeGreaterThan(0);

    // Verify paymentMethodId is stored in the database
    const dbCosts = await db.query.projectCosts.findMany({
      where: eq(projectCosts.projectId, projectId),
    });
    const laborCost = dbCosts.find((c) => c.costType === "labor");
    expect(laborCost).toBeTruthy();
    expect(laborCost?.paymentMethodId).toBe(defaultMethodId);

    const materialCost = dbCosts.find((c) => c.costType === "material");
    expect(materialCost).toBeTruthy();
    expect(materialCost?.paymentMethodId).toBe(defaultMethodId);

    const stockRow = await db.query.inventoryItems.findFirst({
      where: eq(inventoryItems.id, inventoryId),
      columns: { stockQty: true },
    });
    expect(stockRow?.stockQty).toBe(48);

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
    expect(stillStockRow?.stockQty).toBe(48);

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
    expect(projectDetail.profitability.inventoryConsumedCost).toBe(400000);
    expect(projectDetail.profitability.additionalCosts).toBe(100000);

    unwrap(await updateProject({ id: projectId, status: "in_progress" }));
    unwrap(await updateProject({ id: projectId, status: "installation_completed" }));
    unwrap(
      await recordPayment({
        projectId,
        amount: 1396500,
        paymentType: "final",
        paymentMethodId: defaultMethodId ?? "",
        paymentDate: new Date(),
      }),
    );
    unwrap(await markProjectCompleted(projectId));

    // Verify that the month-end close checks pass
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    const closeReport = unwrap(
      await getMonthEndCloseReport({
        year: currentYear,
        month: currentMonth,
      }),
    );
    // Find the payments-posted check
    const paymentsPostedCheck = closeReport.checks.find((c) => c.id === "payments-posted");
    expect(paymentsPostedCheck).toBeTruthy();
    expect(paymentsPostedCheck?.status).toBe("pass");

    const costsPostedCheck = closeReport.checks.find((c) => c.id === "costs-posted");
    expect(costsPostedCheck).toBeTruthy();
    expect(costsPostedCheck?.status).toBe("pass");

    const allAlerts = unwrap(await getWarrantyAlerts({ tab: "all" }));
    const projectAlerts = allAlerts.filter((a) => a.projectId === projectId);
    expect(projectAlerts.length).toBeGreaterThanOrEqual(3);
    warrantyAlertId = projectAlerts[0]?.id ?? "";

    unwrap(await resolveWarrantyAlert(warrantyAlertId));
    unwrap(await reopenWarrantyAlert(warrantyAlertId));

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
    const methodRow = cashMovement.byMethod.find((m) => m.methodName === defaultMethod.name);
    expect(methodRow).toBeTruthy();
    expect(methodRow?.totalIn).toBe(1396500);
    expect(methodRow?.totalOut).toBe(100000);
    expect(methodRow?.netMovement).toBe(1296500);

    // Test repairOrphanCost
    const { repairOrphanCost } = await import("@/actions/recovery-actions");
    const { mapPaymentMethodNameToAssetAccount } = await import("@/lib/finance/ledger");

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
    const legacyCreditLine = legacyEntryLines.find((l) => Number(l.credit) > 0);
    expect(legacyCreditLine?.account.code).toBe("cash_on_hand");

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
    const matCreditLine = matEntryLines.find((l) => Number(l.credit) > 0);
    expect(matCreditLine?.account.code).toBe("raw_materials");

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
    const dynamicCreditLine = dynamicEntryLines.find((l) => Number(l.credit) > 0);
    const expectedAssetAccount = mapPaymentMethodNameToAssetAccount(defaultMethod.name);
    expect(dynamicCreditLine?.account.code).toBe(expectedAssetAccount);

    const stats = unwrap(await getDashboardStats());
    expect(stats.totalCustomers).toBeGreaterThanOrEqual(1);
    expect(stats.pendingQuotationsCount).toBeGreaterThanOrEqual(0);

    const pipeline = unwrap(await getDashboardPipeline());
    expect(pipeline.stages.length).toBe(4);

    const activity = unwrap(await getRecentActivity(10));
    expect(activity.length).toBeGreaterThan(0);

    const upcoming = unwrap(await getUpcomingAlerts(10));
    expect(upcoming.length).toBeGreaterThan(0);

    const unread = unwrap(await getNotificationsWithFilter({ unreadOnly: true }));
    expect(Array.isArray(unread)).toBe(true);
    unwrap(await markAllNotificationsAsRead());
  });
});
