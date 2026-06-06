import { config } from "dotenv";
import { Pool } from "pg";

config({ path: ".env.local" });

type CountRow = { count: string };
type InfoRow = { current_database: string; current_user: string };

async function countTable(pool: Pool, table: string): Promise<number> {
  const res = await pool.query<CountRow>(`select count(*)::text as count from ${table}`);
  return Number(res.rows[0]?.count ?? "0");
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.error("DATABASE_URL is missing in .env.local");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 15_000,
  });

  try {
    const info = await pool.query<InfoRow>("select current_database(), current_user");
    const dbName = info.rows[0]?.current_database ?? "unknown";
    const dbUser = info.rows[0]?.current_user ?? "unknown";

    const checks: Record<string, number> = {
      users: await countTable(pool, "users"),
      auth_rate_limits: await countTable(pool, "auth_rate_limits"),
      owners: await countTable(pool, "owners"),
      owner_transactions: await countTable(pool, "owner_transactions"),
      payment_methods: await countTable(pool, "payment_methods"),
      ledger_accounts: await countTable(pool, "ledger_accounts"),
      company_settings: await countTable(pool, "company_settings"),
      customers: await countTable(pool, "customers"),
      inventory_items: await countTable(pool, "inventory_items"),
      quotations: await countTable(pool, "quotations"),
      quotation_items: await countTable(pool, "quotation_items"),
      projects: await countTable(pool, "projects"),
      project_costs: await countTable(pool, "project_costs"),
      project_remarks: await countTable(pool, "project_remarks"),
      project_payments: await countTable(pool, "project_payments"),
      project_invoices: await countTable(pool, "project_invoices"),
      project_invoice_lines: await countTable(pool, "project_invoice_lines"),
      project_payment_allocations: await countTable(pool, "project_payment_allocations"),
      project_vouchers: await countTable(pool, "project_vouchers"),
      warranty_alerts: await countTable(pool, "warranty_alerts"),
      notifications: await countTable(pool, "notifications"),
      suppliers: await countTable(pool, "suppliers"),
      purchase_orders: await countTable(pool, "purchase_orders"),
      purchase_order_items: await countTable(pool, "purchase_order_items"),
      supplier_payments: await countTable(pool, "supplier_payments"),
      journal_entries: await countTable(pool, "journal_entries"),
      journal_lines: await countTable(pool, "journal_lines"),
      budgets: await countTable(pool, "budgets"),
      accounting_periods: await countTable(pool, "accounting_periods"),
      general_expenses: await countTable(pool, "general_expenses"),
    };

    console.log(`[handover-verify] database=${dbName} user=${dbUser}`);
    for (const [table, cnt] of Object.entries(checks)) {
      console.log(`[handover-verify] ${table}=${cnt}`);
    }

    const dataLeakTables = [
      "customers",
      "inventory_items",
      "quotations",
      "quotation_items",
      "projects",
      "project_costs",
      "project_remarks",
      "project_payments",
      "project_invoices",
      "project_invoice_lines",
      "project_payment_allocations",
      "project_vouchers",
      "warranty_alerts",
      "notifications",
      "suppliers",
      "purchase_orders",
      "purchase_order_items",
      "supplier_payments",
      "journal_entries",
      "journal_lines",
      "budgets",
      "accounting_periods",
      "general_expenses",
      "owner_transactions",
      "auth_rate_limits",
    ];
    const hasLeak = dataLeakTables.some((table) => (checks[table] ?? 0) > 0);

    if (checks.users < 1) {
      console.error("[handover-verify] failed: users table has no admin user.");
      process.exit(1);
    }
    if (checks.payment_methods < 1) {
      console.error("[handover-verify] failed: payment_methods table is empty.");
      process.exit(1);
    }
    if (checks.ledger_accounts < 1) {
      console.error("[handover-verify] failed: ledger_accounts table is empty.");
      process.exit(1);
    }
    if (checks.company_settings < 1) {
      console.error("[handover-verify] failed: company_settings table is empty.");
      process.exit(1);
    }
    // Owners are intentionally 0 at handover — they're created in-app
    // via Settings → Partners. A non-zero count here means the
    // handover DB shipped with stale partners from a previous run.
    if (checks.owners > 0) {
      console.error(
        `[handover-verify] failed: owners table has ${checks.owners} rows. Expected 0 — partners are created in-app.`,
      );
      process.exit(1);
    }
    if (hasLeak) {
      console.error("[handover-verify] failed: operational/test data still exists.");
      process.exit(1);
    }

    console.log("[handover-verify] OK: fresh handover state verified.");
  } finally {
    await pool.end();
  }
}

void main();
