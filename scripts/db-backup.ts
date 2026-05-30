/**
 * Database Backup Script
 *
 * Exports all table data to JSON files in ./backups/<timestamp>/
 * No external tools required (works without pg_dump).
 *
 * Usage:
 *   pnpm db:backup
 *
 * Output:
 *   backups/
 *     2026-05-31T02-00-00/
 *       users.json
 *       customers.json
 *       ...
 *       manifest.json (table counts + metadata)
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, "..");

// Dynamic import to load the db module at runtime
async function loadDb() {
  const mod = await import(join(root, "src", "lib", "db", "index.ts"));
  return mod.db;
}

function resolve(p: string): string {
  const pathMod = require("node:path") as typeof import("node:path");
  return pathMod.resolve(p);
}

const TABLES = [
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

async function main(): Promise<void> {
  const db = await loadDb();

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = join(root, "backups", timestamp);
  await mkdir(backupDir, { recursive: true });

  console.log(`\n backup started: ${backupDir}\n`);

  const manifest: Record<string, number> = {};
  let totalRows = 0;

  for (const table of TABLES) {
    try {
      const result = await db.execute(sql.raw(`SELECT * FROM "${table}"`));
      const rows = result.rows.map((row) => {
        const cleaned: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(row)) {
          if (value instanceof Date) {
            cleaned[key] = value.toISOString();
          } else if (typeof value === "bigint") {
            cleaned[key] = value.toString();
          } else {
            cleaned[key] = value;
          }
        }
        return cleaned;
      });

      const filePath = join(backupDir, `${table}.json`);
      await writeFile(filePath, JSON.stringify(rows, null, 2));

      manifest[table] = rows.length;
      totalRows += rows.length;

      const icon = rows.length > 0 ? "\u2713" : "\u25cb";
      console.log(`  ${icon} ${table}: ${rows.length} rows`);
    } catch (error) {
      manifest[table] = -1;
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`  \u2717 ${table}: ERROR - ${msg}`);
    }
  }

  const manifestData = {
    timestamp: new Date().toISOString(),
    database: process.env["DATABASE_URL"]
      ? new URL(process.env["DATABASE_URL"]).hostname
      : "unknown",
    totalTables: TABLES.length,
    totalRows,
    tables: manifest,
  };

  await writeFile(join(backupDir, "manifest.json"), JSON.stringify(manifestData, null, 2));

  console.log(
    `\n\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550`,
  );
  console.log(`  Backup complete: ${totalRows} rows across ${TABLES.length} tables`);
  console.log(`  Location: ${backupDir}`);
  console.log(
    `\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n`,
  );
}

main().catch((err) => {
  console.error("Backup failed:", err);
  process.exit(1);
});
