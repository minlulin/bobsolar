import { config } from "dotenv";
import { Pool } from "pg";

config({ path: ".env.local" });

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.error("Missing DATABASE_URL in environment.");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 15_000,
  });

  try {
    const before = await pool.query<{ count: string }>(
      "select count(*)::text as count from users where role = 'staff'",
    );
    const beforeCount = Number(before.rows[0]?.count ?? "0");

    const res = await pool.query<{ id: string; email: string }>(
      "update users set role = 'admin' where role = 'staff' returning id, email",
    );

    console.log(`Staff users before: ${beforeCount}`);
    console.log(`Promoted to admin: ${res.rowCount ?? 0}`);
    for (const row of res.rows) {
      console.log(`- ${row.id} ${row.email}`);
    }
    console.log("Promotion run completed (idempotent).");
  } finally {
    await pool.end();
  }
}

void main();
