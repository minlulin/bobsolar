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

if (confirmValue !== "HANDOVER_RESET") {
  console.error("Safety check failed. This command destroys all DB data.");
  console.error("Use: tsx scripts/db-handover-reset.ts --confirm=HANDOVER_RESET");
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
