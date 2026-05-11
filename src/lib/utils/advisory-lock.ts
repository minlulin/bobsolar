import { type SQL, sql } from 'drizzle-orm';

type AdvisoryLockDb = {
  execute(query: SQL): Promise<{ rows: Record<string, unknown>[] }>;
};

/**
 * PostgreSQL advisory lock helper.
 *
 * Uses `pg_try_advisory_lock` to avoid blocking and provide a clean
 * fallback when another process already holds the lock.
 *
 * Usage:
 *   const lock = new AdvisoryLock(db, BigInt(0x42_4f_42_53));
 *   if (await lock.acquire()) {
 *     // critical section
 *     await lock.release();
 *   }
 */
export class AdvisoryLock {
  private db: AdvisoryLockDb;
  private key: bigint;
  private acquired = false;

  constructor(db: AdvisoryLockDb, key: bigint) {
    this.db = db;
    this.key = key;
  }

  async acquire(): Promise<boolean> {
    const result = await this.db.execute(
      sql`SELECT pg_try_advisory_lock(${this.key}::int8) AS "locked"`,
    );
    const row = result.rows[0] as { locked?: unknown } | undefined;
    this.acquired = row?.locked === true;
    return this.acquired;
  }

  async release(): Promise<void> {
    if (this.acquired) {
      try {
        await this.db.execute(
          sql`SELECT pg_advisory_unlock(${this.key}::int8)`,
        );
      } catch {
        // Lock auto-releases on connection close — safe to ignore
      }
      this.acquired = false;
    }
  }
}
