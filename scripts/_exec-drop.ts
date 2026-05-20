/**
 * Drops all tables and enum types from the public schema.
 * Used by db-reset.ts and db-factory-reset.ts.
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

config({ path: resolve(root, ".env.local") });

const databaseUrl = process.env.DATABASE_URL ?? process.env.TEST_DATABASE_URL;

if (!databaseUrl) {
  console.error("❌ No DATABASE_URL or TEST_DATABASE_URL found in .env.local");
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  connectionTimeoutMillis: 15_000,
});

async function main(): Promise<void> {
  // Drop all tables
  await pool.query(`
    DO $$ DECLARE
      r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;
    END $$;
  `);

  // Drop all enum types
  await pool.query(`
    DO $$ DECLARE
      r RECORD;
    BEGIN
      FOR r IN (SELECT t.typname FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid GROUP BY t.typname) LOOP
        EXECUTE 'DROP TYPE IF EXISTS ' || quote_ident(r.typname) || ' CASCADE';
      END LOOP;
    END $$;
  `);

  await pool.end();

  console.log("✓ All tables and enums dropped");
}

main().catch((err) => {
  console.error("Drop failed:", err);
  process.exit(1);
});
