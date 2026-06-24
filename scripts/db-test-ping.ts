import { config } from "dotenv";
import { Pool } from "pg";

config({ path: ".env.local" });

function maskDatabaseUrl(databaseUrl: string): string {
  return databaseUrl.replace(/:\/\/([^:@/]+):([^@/]+)@/u, "://$1:***@");
}

async function main(): Promise<void> {
  const rawUrl = process.env.TEST_DATABASE_URL_DIRECT || process.env.TEST_DATABASE_URL;
  const testDatabaseUrl = rawUrl?.trim() ?? "";

  if (testDatabaseUrl.length === 0) {
    console.error(
      "DB ping failed: TEST_DATABASE_URL_DIRECT (preferred) or TEST_DATABASE_URL is missing in .env.local",
    );
    process.exit(1);
  }

  if (testDatabaseUrl.includes("-pooler.")) {
    console.error(
      "DB ping warning: pooled Neon URL detected (-pooler host). For drizzle-kit push migrations, use a direct URL in TEST_DATABASE_URL_DIRECT.",
    );
  }

  const pool = new Pool({
    connectionString: testDatabaseUrl,
    connectionTimeoutMillis: 15_000,
  });

  try {
    const infoResult = await pool.query<{
      current_database: string;
      current_user: string;
    }>("select current_database(), current_user");

    const databaseName = infoResult.rows[0]?.current_database ?? "unknown";
    const userName = infoResult.rows[0]?.current_user ?? "unknown";

    await pool.query("create extension if not exists vector");

    console.log(
      `DB test setup ok: connected to "${databaseName}" as "${userName}" with vector enabled`,
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("DB ping failed:", message);
    console.error("Target:", maskDatabaseUrl(testDatabaseUrl));
    process.exit(1);
  } finally {
    await pool.end();
  }
}

void main();
