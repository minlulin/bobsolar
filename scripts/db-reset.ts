/**
 * DB Reset & Factory Reset Scripts
 *
 * Usage:
 *   pnpm db:reset             # Full reset + seed
 *   pnpm db:factory-reset     # Reset + minimal bootstrap
 *
 * Both require --confirm=RESET to proceed.
 */

import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = process.argv.slice(2);
const confirmIndex = args.findIndex((a) => a.startsWith('--confirm='));
const confirmValue =
  confirmIndex >= 0 ? args[confirmIndex]!.split('=')[1] : null;
const modeIndex = args.findIndex((a) => a.startsWith('--mode='));
const modeValue = modeIndex >= 0 ? args[modeIndex]!.split('=')[1] : 'full';

if (confirmValue !== 'RESET') {
  console.error('❌ Safety check failed: pass --confirm=RESET to proceed.');
  console.error('   This will DESTROY all data in your database.');
  process.exit(1);
}

const root = resolve(__dirname, '..');
const isFactoryReset = modeValue === 'factory';

function run(cmd: string, label: string): void {
  console.log(`\n▶ ${label}...`);
  execSync(cmd, { cwd: root, stdio: 'inherit' });
  console.log(`✓ ${label} complete`);
}

console.log('═══════════════════════════════════════');
console.log(isFactoryReset ? '🏭 FACTORY RESET' : '🔄 DB RESET');
console.log('═══════════════════════════════════════');

run('tsx scripts/_exec-drop.ts', 'Dropping all tables and enums');
run('pnpm exec drizzle-kit push', 'Pushing fresh schema');

if (isFactoryReset) {
  run('tsx src/lib/db/factory-bootstrap.ts', 'Seeding minimal bootstrap data');
} else {
  run('pnpm db:seed', 'Seeding full data');
}

console.log('\n═══════════════════════════════════════');
console.log(
  isFactoryReset
    ? '🏭 Factory reset complete — clean handoff state'
    : '🔄 DB reset complete',
);
console.log('═══════════════════════════════════════');
