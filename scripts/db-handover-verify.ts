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
      customers: await countTable(pool, "customers"),
      inventory_items: await countTable(pool, "inventory_items"),
      quotations: await countTable(pool, "quotations"),
      projects: await countTable(pool, "projects"),
      project_costs: await countTable(pool, "project_costs"),
      project_payments: await countTable(pool, "project_payments"),
      project_vouchers: await countTable(pool, "project_vouchers"),
      warranty_alerts: await countTable(pool, "warranty_alerts"),
      notifications: await countTable(pool, "notifications"),
      journal_entries: await countTable(pool, "journal_entries"),
      journal_lines: await countTable(pool, "journal_lines"),
    };

    console.log(`[handover-verify] database=${dbName} user=${dbUser}`);
    for (const [table, cnt] of Object.entries(checks)) {
      console.log(`[handover-verify] ${table}=${cnt}`);
    }

    const dataLeakTables = [
      "customers",
      "inventory_items",
      "quotations",
      "projects",
      "project_costs",
      "project_payments",
      "project_vouchers",
      "warranty_alerts",
      "notifications",
      "journal_entries",
      "journal_lines",
    ];
    const hasLeak = dataLeakTables.some((table) => (checks[table] ?? 0) > 0);

    if (checks.users < 1) {
      console.error("[handover-verify] failed: users table has no admin user.");
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
