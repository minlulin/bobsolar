/**
 * Drop-in replacement for `drizzle-kit migrate` that prints the underlying
 * error instead of hiding it behind the CLI spinner.
 */
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL_DIRECT or DATABASE_URL must be set in .env.local");
  process.exit(1);
}

if (url.includes("-pooler.")) {
  console.error(
    "This migrator must use a DIRECT (non-pooler) Neon connection string.\n" +
      "  Set DATABASE_URL_DIRECT, or pass a non-pooler URL.",
  );
  process.exit(1);
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: url, connectionTimeoutMillis: 20_000 });
  const db = drizzle(pool);

  console.log("Applying migrations from ./drizzle/migrations ...");
  const start = Date.now();

  try {
    await migrate(db, { migrationsFolder: "./drizzle/migrations" });
    console.log(`\u2713 All migrations applied in ${Date.now() - start}ms`);
  } catch (err) {
    console.error("\u2717 Migration failed:");
    if (err instanceof Error) {
      console.error("  message:", err.message);
      const cause = (err as { cause?: unknown }).cause;
      if (cause instanceof Error) {
        console.error("  cause  :", cause.message);
      }
    } else {
      console.error(err);
    }
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void main();
