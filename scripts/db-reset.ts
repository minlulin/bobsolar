/**
 * DB Reset & Factory Reset Scripts
 *
 * Usage:
 *   pnpm db:reset             # Full reset + seed (requires --confirm=RESET or interactive prompt)
 *   pnpm db:factory-reset     # Reset + minimal bootstrap
 *
 * Both require --confirm=RESET to proceed.
 */

import { execSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = process.argv.slice(2);
const confirmIndex = args.findIndex((a) => a.startsWith("--confirm="));
const confirmValue = confirmIndex >= 0 ? (args[confirmIndex]?.split("=")[1] ?? null) : null;
const modeIndex = args.findIndex((a) => a.startsWith("--mode="));
const modeValue = modeIndex >= 0 ? (args[modeIndex]?.split("=")[1] ?? "full") : "full";

const root = resolve(__dirname, "..");
const isFactoryReset = modeValue === "factory";

function run(cmd: string, label: string): void {
  console.log(`\n\u25b6 ${label}...`);
  execSync(cmd, { cwd: root, stdio: "inherit" });
  console.log(`\u2713 ${label} complete`);
}

async function getInteractiveConfirm(): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(
      "\u26a0\ufe0f  WARNING: This will DESTROY ALL DATA in your database.\nType 'RESET' to continue: ",
      (answer) => {
        rl.close();
        resolve(answer.trim() === "RESET");
      },
    );
  });
}

async function main(): Promise<void> {
  if (confirmValue !== "RESET") {
    const interactiveOk = await getInteractiveConfirm();
    if (!interactiveOk) {
      console.error("❌ Aborted. Pass --confirm=RESET to skip interactive prompt.");
      process.exit(1);
    }
  }

  console.log("═══════════════════════════════════════");
  console.log(isFactoryReset ? "\uD83C\uDFED FACTORY RESET" : "\uD83D\uDD04 DB RESET");
  console.log("═══════════════════════════════════════");

  run("tsx scripts/_exec-drop.ts", "Dropping all tables and enums");
  run("pnpm exec drizzle-kit push", "Pushing fresh schema");

  if (isFactoryReset) {
    run("tsx src/lib/db/factory-bootstrap.ts", "Seeding minimal bootstrap data");
  } else {
    run("tsx src/lib/db/factory-bootstrap.ts", "Seeding minimal bootstrap data");
    run("pnpm db:seed", "Seeding full data");
  }

  console.log("\n═══════════════════════════════════════");
  console.log(
    isFactoryReset
      ? "\uD83C\uDFED Factory reset complete \u2014 clean handoff state"
      : "\uD83D\uDD04 DB reset complete",
  );
  console.log("═══════════════════════════════════════");
}

main().catch((err) => {
  console.error("Reset failed:", err);
  process.exit(1);
});
