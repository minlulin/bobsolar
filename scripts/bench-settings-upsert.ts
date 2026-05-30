import { performance } from "node:perf_hooks";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { companySettings } from "@/lib/db/schema";

const PREFIX = `perf:settings:${Date.now()}:`;
const ENTRY_COUNT = 24;
const ROUNDS = 20;

const entries = Object.fromEntries(
  Array.from({ length: ENTRY_COUNT }, (_, i) => [`${PREFIX}k${i}`, `v${i}`]),
);

async function cleanup(): Promise<void> {
  for (const key of Object.keys(entries)) {
    await db.delete(companySettings).where(eq(companySettings.key, key));
  }
}

async function loopMode(data: Record<string, string>): Promise<void> {
  await db.transaction(async (tx) => {
    for (const [key, value] of Object.entries(data)) {
      await tx
        .insert(companySettings)
        .values({ key, value })
        .onConflictDoUpdate({
          target: companySettings.key,
          set: { value, updatedAt: new Date() },
        });
    }
  });
}

async function bulkMode(data: Record<string, string>): Promise<void> {
  const rows = Object.entries(data).map(([key, value]) => ({ key, value }));
  await db
    .insert(companySettings)
    .values(rows)
    .onConflictDoUpdate({
      target: companySettings.key,
      set: { value: sql`excluded.value`, updatedAt: new Date() },
    });
}

async function run(): Promise<void> {
  await cleanup();
  await loopMode(entries);

  const beforeStart = performance.now();
  for (let i = 0; i < ROUNDS; i += 1) {
    await loopMode(entries);
  }
  const beforeMs = performance.now() - beforeStart;

  const afterStart = performance.now();
  for (let i = 0; i < ROUNDS; i += 1) {
    await bulkMode(entries);
  }
  const afterMs = performance.now() - afterStart;

  await cleanup();

  const deltaMs = beforeMs - afterMs;
  const improvementPct = (deltaMs / beforeMs) * 100;
  console.log(
    JSON.stringify(
      {
        entryCount: ENTRY_COUNT,
        rounds: ROUNDS,
        beforeMs,
        afterMs,
        deltaMs,
        improvementPct,
      },
      null,
      2,
    ),
  );
}

void run();
