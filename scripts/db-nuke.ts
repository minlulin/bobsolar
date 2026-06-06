/**
 * Nuclear drop — clears the public schema AND the drizzle bookkeeping schema.
 * Use when migration history is out of sync with actual DB state.
 */
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL ?? process.env.DATABASE_URL_DIRECT;
if (!url) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

const c = new pg.Pool({ connectionString: url, connectionTimeoutMillis: 15_000 });

async function main(): Promise<void> {
  try {
    await c.query("DROP SCHEMA IF EXISTS public CASCADE");
    await c.query("CREATE SCHEMA public");
    await c.query("GRANT ALL ON SCHEMA public TO public");
    console.log("\u2713 'public' schema dropped and recreated");

    await c.query("DROP SCHEMA IF EXISTS drizzle CASCADE");
    console.log("\u2713 'drizzle' schema dropped (migration history reset)");
  } catch (err) {
    console.error("Reset failed:", err);
    process.exitCode = 1;
  } finally {
    await c.end();
  }
}

void main();
