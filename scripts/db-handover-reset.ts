/**
 * Handover Reset
 *
 * Purpose:
 * - Wipe all existing app data (test data + old production)
 * - Recreate schema from current Drizzle migrations
 * - Seed clean state from .env.local (admin + company settings)
 * - NOTE: partners are NOT seeded — they are created in-app via
 *   Settings → Partners after handover.
 *
 * Usage:
 *   pnpm db:handover-reset
 *
 * Safety:
 * - Requires --confirm=HANDOVER_RESET (provided by package.json script)
 * - Production databases require --force-production flag
 * - Aborts early if required env vars (DATABASE_URL_DIRECT, SEED_ADMIN_*) are missing
 */

import { execSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, "..");

config({ path: resolve(root, ".env.local") });

const args = process.argv.slice(2);
const confirmArg = args.find((arg) => arg.startsWith("--confirm="));
const confirmValue = confirmArg?.split("=")[1] ?? "";
const forceProduction = args.includes("--force-production");

if (confirmValue !== "HANDOVER_RESET") {
  console.error("Safety check failed. This command destroys all DB data.");
  console.error("Use: tsx scripts/db-handover-reset.ts --confirm=HANDOVER_RESET");
  process.exit(1);
}

function isProductionDatabase(): boolean {
  const dbUrl = process.env["DATABASE_URL"] ?? process.env["DATABASE_URL_DIRECT"] ?? "";
  if (!dbUrl) return false;
  if (dbUrl.includes("localhost") || dbUrl.includes("127.0.0.1")) return false;
  if (dbUrl.includes("test") || dbUrl.includes("TEST")) return false;
  return true;
}

function getDatabaseHost(): string {
  const dbUrl = process.env["DATABASE_URL"] ?? process.env["DATABASE_URL_DIRECT"] ?? "";
  try {
    const url = new URL(dbUrl);
    return url.hostname;
  } catch {
    return "unknown";
  }
}

if (isProductionDatabase() && !forceProduction) {
  const host = getDatabaseHost();
  console.error("\nPRODUCTION DATABASE DETECTED");
  console.error(`Host: ${host}`);
  console.error("This command will DESTROY ALL DATA in production.");
  console.error("To proceed, re-run with --force-production flag:");
  console.error("  pnpm db:handover-reset --confirm=HANDOVER_RESET --force-production");
  process.exit(1);
}

const requiredEnvVars = ["DATABASE_URL_DIRECT", "SEED_ADMIN_EMAIL", "SEED_ADMIN_PASSWORD"] as const;
const missingEnvVars = requiredEnvVars.filter((name) => !process.env[name]?.trim());
if (missingEnvVars.length > 0) {
  console.error("Missing required env vars in .env.local:");
  for (const name of missingEnvVars) console.error(`  - ${name}`);
  console.error("\nAdd the missing values to .env.local and re-run.");
  process.exit(1);
}

function run(cmd: string, label: string): void {
  console.log(`\n[handover-reset] ${label}`);
  execSync(cmd, { cwd: root, stdio: "inherit" });
}

console.log("========================================");
console.log("DB HANDOVER RESET START");
console.log("========================================");

run("pnpm exec tsx scripts/db-nuke.ts", "Drop public + drizzle schemas (full reset)");
run("pnpm db:migrate", "Apply all migrations from scratch");
run(
  "tsx src/lib/db/factory-bootstrap.ts",
  "Seed factory bootstrap (company settings + payment methods + ledger accounts)",
);
run("pnpm db:seed", "Seed from .env.local (admin)");
run("tsx scripts/db-handover-verify.ts", "Verify fresh handover state");

console.log("\n========================================");
console.log("DB HANDOVER RESET COMPLETE");
console.log("Log in as the admin user, then go to Settings → Partners");
console.log("to add the 3 partners (name, email, password, ownership %).");
console.log("========================================");
