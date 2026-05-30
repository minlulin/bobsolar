"use server";

import { del, list, put } from "@vercel/blob";
import { requireAdmin } from "@/lib/auth/validate";
import { db } from "@/lib/db";
import {
  accountingPeriods,
  authRateLimits,
  budgets,
  companySettings,
  customers,
  idempotencyKeys,
  inventoryItems,
  journalEntries,
  journalLines,
  ledgerAccounts,
  notifications,
  paymentMethods,
  projectCosts,
  projectInvoiceLines,
  projectInvoices,
  projectPaymentAllocations,
  projectPayments,
  projectRemarks,
  projects,
  projectVouchers,
  purchaseOrderItems,
  purchaseOrders,
  quotationItems,
  quotations,
  sessions,
  supplierPayments,
  suppliers,
  users,
  warrantyAlerts,
} from "@/lib/db/schema";
import { type ActionResponse, successResponse } from "@/lib/utils/action-response";
import { handleActionError } from "@/lib/utils/error";

const BACKUP_FOLDER = "backups";

type AnyTable = { [Symbol.iterator](): IterableIterator<unknown> };

const TABLE_NAMES = [
  "users",
  "sessions",
  "auth_rate_limits",
  "customers",
  "inventory_items",
  "quotations",
  "quotation_items",
  "projects",
  "project_costs",
  "project_remarks",
  "warranty_alerts",
  "notifications",
  "company_settings",
  "project_invoices",
  "project_invoice_lines",
  "project_payment_allocations",
  "project_vouchers",
  "payment_methods",
  "project_payments",
  "suppliers",
  "purchase_orders",
  "purchase_order_items",
  "supplier_payments",
  "ledger_accounts",
  "journal_entries",
  "journal_lines",
  "budgets",
  "accounting_periods",
  "idempotency_keys",
] as const;

const TABLE_MAP: Record<string, AnyTable> = {
  users: users as unknown as AnyTable,
  sessions: sessions as unknown as AnyTable,
  auth_rate_limits: authRateLimits as unknown as AnyTable,
  customers: customers as unknown as AnyTable,
  inventory_items: inventoryItems as unknown as AnyTable,
  quotations: quotations as unknown as AnyTable,
  quotation_items: quotationItems as unknown as AnyTable,
  projects: projects as unknown as AnyTable,
  project_costs: projectCosts as unknown as AnyTable,
  project_remarks: projectRemarks as unknown as AnyTable,
  warranty_alerts: warrantyAlerts as unknown as AnyTable,
  notifications: notifications as unknown as AnyTable,
  company_settings: companySettings as unknown as AnyTable,
  project_invoices: projectInvoices as unknown as AnyTable,
  project_invoice_lines: projectInvoiceLines as unknown as AnyTable,
  project_payment_allocations: projectPaymentAllocations as unknown as AnyTable,
  project_vouchers: projectVouchers as unknown as AnyTable,
  payment_methods: paymentMethods as unknown as AnyTable,
  project_payments: projectPayments as unknown as AnyTable,
  suppliers: suppliers as unknown as AnyTable,
  purchase_orders: purchaseOrders as unknown as AnyTable,
  purchase_order_items: purchaseOrderItems as unknown as AnyTable,
  supplier_payments: supplierPayments as unknown as AnyTable,
  ledger_accounts: ledgerAccounts as unknown as AnyTable,
  journal_entries: journalEntries as unknown as AnyTable,
  journal_lines: journalLines as unknown as AnyTable,
  budgets: budgets as unknown as AnyTable,
  accounting_periods: accountingPeriods as unknown as AnyTable,
  idempotency_keys: idempotencyKeys as unknown as AnyTable,
};

function serializeValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(serializeValue);
  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = serializeValue(v);
    }
    return result;
  }
  return value;
}

async function exportAllTables(): Promise<{
  data: Record<string, unknown[]>;
  manifest: Record<string, number>;
  totalRows: number;
}> {
  const data: Record<string, unknown[]> = {};
  const manifest: Record<string, number> = {};
  let totalRows = 0;

  for (const name of TABLE_NAMES) {
    try {
      const table = TABLE_MAP[name];
      const result = await db.select().from(table as never);
      const rows = result.map((row) => serializeValue(row) as Record<string, unknown>);
      data[name] = rows;
      manifest[name] = rows.length;
      totalRows += rows.length;
    } catch {
      data[name] = [];
      manifest[name] = 0;
    }
  }

  return { data, manifest, totalRows };
}

function requireBlobToken(): string {
  const token = process.env["BLOB_READ_WRITE_TOKEN"];
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN is not configured");
  return token;
}

export interface BackupMetadata {
  url: string;
  filename: string;
  timestamp: string;
  totalRows: number;
  tables: Record<string, number>;
  size: number;
}

export async function createBackup(): Promise<ActionResponse<BackupMetadata>> {
  try {
    const session = await requireAdmin();
    const token = requireBlobToken();

    const { data, manifest, totalRows } = await exportAllTables();

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `backup-${timestamp}.json`;

    const payload = {
      metadata: {
        timestamp: new Date().toISOString(),
        createdBy: session.userId,
        totalRows,
        tables: manifest,
      },
      data,
    };

    const json = JSON.stringify(payload);
    const buffer = Buffer.from(json, "utf-8");

    const blob = await put(`${BACKUP_FOLDER}/${filename}`, buffer, {
      access: "public",
      token,
      contentType: "application/json",
      cacheControlMaxAge: 60 * 60 * 24 * 365,
    });

    const metadata: BackupMetadata = {
      url: blob.url,
      filename,
      timestamp: new Date().toISOString(),
      totalRows,
      tables: manifest,
      size: buffer.length,
    };

    return successResponse(metadata);
  } catch (error) {
    return handleActionError(error, "createBackup", "Failed to create backup");
  }
}

export async function getBackupHistory(): Promise<ActionResponse<BackupMetadata[]>> {
  try {
    await requireAdmin();

    const token = process.env["BLOB_READ_WRITE_TOKEN"];
    if (!token) {
      return successResponse([]);
    }

    const { blobs } = await list({
      prefix: `${BACKUP_FOLDER}/`,
      token,
    });

    const backups: BackupMetadata[] = blobs
      .filter((blob) => blob.pathname.endsWith(".json"))
      .map((blob) => ({
        url: blob.url,
        filename: blob.pathname.split("/").pop() ?? blob.pathname,
        timestamp: blob.uploadedAt.toISOString(),
        totalRows: 0,
        tables: {},
        size: blob.size,
      }))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return successResponse(backups);
  } catch (error) {
    return handleActionError(error, "getBackupHistory", "Failed to fetch backup history");
  }
}

export async function deleteBackup(url: string): Promise<ActionResponse<null>> {
  try {
    await requireAdmin();
    const token = requireBlobToken();

    await del(url, { token });

    return successResponse(null);
  } catch (error) {
    return handleActionError(error, "deleteBackup", "Failed to delete backup");
  }
}

export async function createBackupInternal(): Promise<BackupMetadata> {
  const token = requireBlobToken();

  const { data, manifest, totalRows } = await exportAllTables();

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `backup-${timestamp}.json`;

  const payload = {
    metadata: {
      timestamp: new Date().toISOString(),
      createdBy: "cron",
      totalRows,
      tables: manifest,
    },
    data,
  };

  const json = JSON.stringify(payload);
  const buffer = Buffer.from(json, "utf-8");

  const blob = await put(`${BACKUP_FOLDER}/${filename}`, buffer, {
    access: "public",
    token,
    contentType: "application/json",
    cacheControlMaxAge: 60 * 60 * 24 * 365,
  });

  return {
    url: blob.url,
    filename,
    timestamp: new Date().toISOString(),
    totalRows,
    tables: manifest,
    size: buffer.length,
  };
}
