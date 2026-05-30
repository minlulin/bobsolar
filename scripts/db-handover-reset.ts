/**
 * Handover Reset
 *
 * Purpose:
 * - Remove all existing app data (including your test data)
 * - Recreate schema from current Drizzle definitions
 * - Seed from .env.local via db:seed (admin credentials from env)
 *
 * Usage:
 *   pnpm db:handover-reset
 *
 * Safety:
 * - Requires --confirm=HANDOVER_RESET (provided by package.json script)
 * - Production databases require --force-production flag
 */

import { execSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, "..");

const args = process.argv.slice(2);
const confirmArg = args.find((arg) => arg.startsWith("--confirm="));
const confirmValue = confirmArg?.split("=")[1] ?? "";
const forceProduction = args.includes("--force-production") as true;

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
  console.error("\n\u274c\u274c\u274c PRODUCTION DATABASE DETECTED \u274c\u274c\u274c");
  console.error(`\u274c Host: ${host}`);
  console.error("\u274c This command will DESTROY ALL DATA in production.");
  console.error("\u274c To proceed, re-run with --force-production flag:");
  console.error("\u274c   pnpm db:handover-reset --confirm=HANDOVER_RESET --force-production");
  process.exit(1);
}

function run(cmd: string, label: string): void {
  console.log(`\n[handover-reset] ${label}`);
  execSync(cmd, { cwd: root, stdio: "inherit" });
}

console.log("========================================");
console.log("DB HANDOVER RESET START");
console.log("========================================");

run("tsx scripts/_exec-drop.ts", "Drop all tables and enums");
run("pnpm exec drizzle-kit push", "Apply schema");
run(
  "tsx src/lib/db/factory-bootstrap.ts",
  "Seed factory bootstrap (payment methods + ledger accounts)",
);
run("pnpm db:seed", "Seed from .env.local (admin + base data)");
run("tsx scripts/db-handover-verify.ts", "Verify fresh handover state");

console.log("\n========================================");
console.log("DB HANDOVER RESET COMPLETE");
console.log("Fresh start data is ready.");
console.log("========================================");
