import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

// drizzle-kit migrate must use a direct (non-pooled) connection string.
// Neon's PgBouncer-pooled endpoints block session-level features that
// drizzle-kit requires (e.g. advisory locks, SET session).  Prefer
// DATABASE_URL_DIRECT; fall back to DATABASE_URL and reject pooled URLs.
const rawUrl = process.env.DATABASE_URL_DIRECT?.trim() || process.env.DATABASE_URL?.trim();
if (!rawUrl) {
  throw new Error("DATABASE_URL_DIRECT (preferred) or DATABASE_URL is not set in .env.local");
}

if (rawUrl.includes("-pooler.")) {
  throw new Error(
    "drizzle-kit migrate must use a direct Neon connection string (non-pooler).\n" +
      "  Set DATABASE_URL_DIRECT to your direct endpoint URL.\n" +
      "  Hint: copy DATABASE_URL and remove '-pooler' from the hostname.",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle/migrations",
  dbCredentials: {
    url: rawUrl,
  },
  verbose: true,
  strict: true,
});
