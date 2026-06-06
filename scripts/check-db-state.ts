import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

async function main(): Promise<void> {
  const c = new pg.Pool({ connectionString: url, connectionTimeoutMillis: 15_000 });
  try {
    const m = await c.query(
      "SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id",
    );
    console.log(`Migrations recorded: ${m.rowCount}`);
    for (const r of m.rows) {
      console.log(`  #${r.id}  hash=${String(r.hash).slice(0, 12)}...  created_at=${r.created_at}`);
    }

    const t = await c.query(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
    );
    console.log(`\nTables in 'public' schema: ${t.rowCount}`);
    for (const r of t.rows) console.log(`  ${r.tablename}`);

    const e = await c.query(
      "SELECT t.typname FROM pg_type t JOIN pg_enum en ON t.oid = en.enumtypid GROUP BY t.typname ORDER BY t.typname",
    );
    console.log(`\nEnums in 'public' schema: ${e.rowCount}`);
    for (const r of e.rows) console.log(`  ${r.typname}`);
  } catch (err) {
    console.error("Query failed:", err);
  } finally {
    await c.end();
  }
}

void main();
