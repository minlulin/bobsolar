import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

const directTestDatabaseUrl = process.env.TEST_DATABASE_URL_DIRECT?.trim();
const fallbackTestDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
const testDatabaseUrl = directTestDatabaseUrl || fallbackTestDatabaseUrl;

if (!testDatabaseUrl) {
  throw new Error(
    "TEST_DATABASE_URL_DIRECT (preferred) or TEST_DATABASE_URL is not set. Add it to .env.local for test database migrations.",
  );
}

if (testDatabaseUrl.includes("-pooler.")) {
  throw new Error(
    "db:migrate:test uses drizzle-kit push and must use a direct Neon connection string (non-pooler). Set TEST_DATABASE_URL_DIRECT to your direct endpoint URL.",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle/migrations",
  dbCredentials: {
    url: testDatabaseUrl,
  },
  verbose: true,
  strict: true,
});
