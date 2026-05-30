import { config } from "dotenv";
import { db } from "../src/lib/db";
import {
  customers,
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
} from "../src/lib/db/schema";

config({ path: ".env.local" });

async function main() {
  console.log("Cleaning test database...");
  await db.delete(journalLines);
  await db.delete(projectPaymentAllocations);
  await db.delete(projectInvoiceLines);
  await db.delete(projectInvoices);
  await db.delete(projectPayments);
  await db.delete(projectRemarks);
  await db.delete(projectCosts);
  await db.delete(warrantyAlerts);
  await db.delete(projectVouchers);
  await db.delete(projects);
  await db.delete(journalEntries);
  await db.delete(quotationItems);
  await db.delete(quotations);
  await db.delete(customers);
  await db.delete(notifications);
  await db.delete(users);
  console.log("Cleanup finished.");
}

main().catch(console.error);
