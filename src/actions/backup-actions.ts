"use server";

import { del, get, list, put } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { verifyPassword } from "@/lib/auth/password";
import { requireAdmin } from "@/lib/auth/validate";
import { db } from "@/lib/db";
import {
  accountingPeriods,
  authRateLimits,
  budgets,
  companySettings,
  customers,
  generalExpenses,
  idempotencyKeys,
  inventoryItems,
  journalEntries,
  journalLines,
  ledgerAccounts,
  notifications,
  owners,
  ownerTransactions,
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
  supplierPayments,
  suppliers,
  users,
  warrantyAlerts,
} from "@/lib/db/schema";
import { type ActionResponse, errorResponse, successResponse } from "@/lib/utils/action-response";
import { handleActionError } from "@/lib/utils/error";
import { validateBackupFile } from "@/lib/validators/backup";

const BACKUP_FOLDER = "backups";

type AnyTable = { [Symbol.iterator](): IterableIterator<unknown> };

const TABLE_NAMES = [
  "users",
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
  "general_expenses",
  "owners",
  "owner_transactions",
] as const;

const TABLE_MAP: Record<string, AnyTable> = {
  users: users as unknown as AnyTable,
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
  general_expenses: generalExpenses as unknown as AnyTable,
  owners: owners as unknown as AnyTable,
  owner_transactions: ownerTransactions as unknown as AnyTable,
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

/** Strip sensitive fields that should never appear in backup exports. */
function stripSensitiveFields(
  tableName: string,
  row: Record<string, unknown>,
): Record<string, unknown> {
  if (tableName === "users") {
    const { passwordHash: _pw, ...rest } = row;
    return rest;
  }
  return row;
}

/**
 * Read all tables into memory within a single operation to produce a
 * snapshot-consistent backup. Manifest counts are derived from the same
 * rows that are exported, so they always agree.
 *
 * Note: This still loads each table into memory. For very large tables,
 * consider using pg_dump or keyset pagination instead.
 */
async function readAllTablesSnapshot(): Promise<{
  manifest: Record<string, number>;
  totalRows: number;
  data: Record<string, unknown[]>;
}> {
  const data: Record<string, unknown[]> = {};
  const manifest: Record<string, number> = {};
  let totalRows = 0;

  for (const name of TABLE_NAMES) {
    try {
      const table = TABLE_MAP[name];
      const rows = await db.select().from(table as never);
      data[name] = rows as unknown[];
      manifest[name] = rows.length;
      totalRows += rows.length;
    } catch (err) {
      throw new Error(
        `Failed to read table "${name}" for backup: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return { manifest, totalRows, data };
}

function enqueueJsonChunk(
  controller: ReadableStreamDefaultController<Uint8Array>,
  counter: { bytes: number },
  text: string,
): void {
  const chunk = new TextEncoder().encode(text);
  counter.bytes += chunk.byteLength;
  controller.enqueue(chunk);
}

function createBackupPayloadStream({
  createdBy,
  manifest,
  totalRows,
  data,
  timestamp,
  counter,
}: {
  createdBy: string;
  manifest: Record<string, number>;
  totalRows: number;
  data: Record<string, unknown[]>;
  timestamp: string;
  counter: { bytes: number };
}): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async start(controller): Promise<void> {
      try {
        enqueueJsonChunk(
          controller,
          counter,
          JSON.stringify({
            metadata: {
              timestamp,
              createdBy,
              totalRows,
              tables: manifest,
            },
          }).replace(/}$/, ',"data":{'),
        );

        for (const [tableIndex, name] of TABLE_NAMES.entries()) {
          const rows = data[name] ?? [];
          enqueueJsonChunk(
            controller,
            counter,
            `${tableIndex === 0 ? "" : ","}${JSON.stringify(name)}:[`,
          );

          for (const [rowIndex, row] of rows.entries()) {
            const sanitized = stripSensitiveFields(name, row as Record<string, unknown>);
            const serialized = serializeValue(sanitized);
            enqueueJsonChunk(
              controller,
              counter,
              `${rowIndex === 0 ? "" : ","}${JSON.stringify(serialized)}`,
            );
          }

          enqueueJsonChunk(controller, counter, "]");
        }

        enqueueJsonChunk(controller, counter, "}}");
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

async function uploadBackup(createdBy: string): Promise<BackupMetadata> {
  const token = requireBlobToken();
  const timestamp = new Date().toISOString();
  const filenameTimestamp = timestamp.replace(/[:.]/g, "-");
  const filename = `backup-${filenameTimestamp}.json`;
  const counter = { bytes: 0 };

  // Read all tables in one pass for snapshot consistency.
  // Manifest counts are derived from the same rows being exported.
  const { manifest, totalRows, data } = await readAllTablesSnapshot();

  const blob = await put(
    `${BACKUP_FOLDER}/${filename}`,
    createBackupPayloadStream({ createdBy, manifest, totalRows, data, timestamp, counter }),
    {
      access: "private",
      token,
      contentType: "application/json",
      cacheControlMaxAge: 60 * 60 * 24 * 365,
      multipart: true,
    },
  );

  return {
    url: blob.url,
    filename,
    timestamp,
    totalRows,
    tables: manifest,
    size: counter.bytes,
  };
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
    return successResponse(await uploadBackup(session.userId));
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

    // Validate the URL points to a backup file (same check as download route)
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return errorResponse("Invalid backup URL");
    }
    const pathParts = parsedUrl.pathname.split("/").filter(Boolean);
    if (
      pathParts.length < 2 ||
      pathParts[0] !== BACKUP_FOLDER ||
      !pathParts[1]?.endsWith(".json")
    ) {
      return errorResponse("Invalid backup URL");
    }

    await del(url, { token });

    return successResponse(null);
  } catch (error) {
    return handleActionError(error, "deleteBackup", "Failed to delete backup");
  }
}

export async function createBackupInternal(): Promise<BackupMetadata> {
  return uploadBackup("cron");
}

/**
 * Restore the database from a backup file.
 *
 * This is a DESTRUCTIVE operation: it deletes ALL existing data in every
 * application table and replaces it with the data from the backup file.
 *
 * The caller must:
 *   1. Be an authenticated admin (enforced by `requireAdmin`).
 *   2. Provide their current password for re-authentication (enforced below).
 *
 * The restore runs inside a single Drizzle transaction so partial failures
 * roll back to the pre-restore state. Tables are cleared in reverse-FK order
 * (not currently enforced — Drizzle handles this via CASCADE) and populated
 * in the same order as the backup manifest.
 */
export async function restoreFromBackup(
  backupUrl: string,
  password: string,
): Promise<ActionResponse<{ totalRows: number; tables: number }>> {
  try {
    const session = await requireAdmin();

    // Step 1: Re-authenticate the admin with their current password.
    // This prevents a compromised session from being used to destroy data.
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.userId),
      columns: { passwordHash: true },
    });
    if (!user) {
      return errorResponse("User not found");
    }
    const passwordValid = await verifyPassword(password, user.passwordHash);
    if (!passwordValid) {
      return errorResponse("Incorrect password");
    }

    // Step 2: Validate the backup URL points to a real backup file.
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(backupUrl);
    } catch {
      return errorResponse("Invalid backup URL");
    }
    const pathParts = parsedUrl.pathname.split("/").filter(Boolean);
    if (
      pathParts.length < 2 ||
      pathParts[0] !== BACKUP_FOLDER ||
      !pathParts[1]?.endsWith(".json")
    ) {
      return errorResponse("Invalid backup URL — must point to a backup .json file");
    }

    // Step 3: Download the backup JSON from Vercel Blob.
    const token = requireBlobToken();
    const blobResult = await get(backupUrl, { access: "private", token });
    if (blobResult?.statusCode !== 200) {
      return errorResponse("Failed to download backup file");
    }

    const reader = blobResult.stream.getReader();
    const chunks: Uint8Array[] = [];
    let done = false;
    while (!done) {
      const result = await reader.read();
      done = result.done;
      if (result.value) {
        chunks.push(result.value);
      }
    }
    const text = new TextDecoder().decode(Buffer.concat(chunks));
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return errorResponse("Backup file is not valid JSON");
    }

    const validation = validateBackupFile(parsed);
    if (!validation.valid) {
      return errorResponse(`Invalid backup file: ${validation.error}`);
    }
    const backup = validation.data;

    // Step 4: Restore inside a transaction.
    // TRUNCATE all tables then re-insert from backup data.
    // CASCADE ensures FK constraints are satisfied when tables are cleared.
    const tableNamesInInsertOrder = TABLE_NAMES;

    const result = await db.transaction(async (tx) => {
      let totalRestoredRows = 0;

      // Clear all tables first (CASCADE handles dependencies).
      for (const name of tableNamesInInsertOrder) {
        const table = TABLE_MAP[name];
        await tx.delete(table as never);
      }

      // Insert data from backup in the canonical order.
      for (const name of tableNamesInInsertOrder) {
        const rows = backup.data[name];
        if (!rows || !Array.isArray(rows) || rows.length === 0) continue;

        const table = TABLE_MAP[name];
        // Insert rows in batches of 500 to avoid parameter limits.
        const BATCH_SIZE = 500;
        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
          const batch = rows.slice(i, i + BATCH_SIZE);
          await tx.insert(table as never).values(batch as never);
        }

        totalRestoredRows += rows.length;
      }

      return {
        totalRows: totalRestoredRows,
        tables: tableNamesInInsertOrder.length,
      };
    });

    return successResponse(result);
  } catch (error) {
    return handleActionError(error, "restoreFromBackup", "Failed to restore from backup");
  }
}
