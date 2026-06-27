import { type SQL, sql } from "drizzle-orm";

type AdvisoryLockDb = {
  execute(query: SQL): Promise<{ rows: Record<string, unknown>[] }>;
};

/**
 * PostgreSQL advisory lock helper.
 *
 * IMPORTANT — connection & transaction semantics:
 *   This class uses `pg_try_advisory_xact_lock` which is **transaction-scoped**.
 *   The lock is automatically released when the transaction commits or rolls
 *   back — there is no explicit `release()` call needed. This is the correct
 *   behavior for atomic sequences (quote numbering, etc.).
 *
 *   Callers MUST pass a transaction handle (`tx` from `db.transaction(async tx => …)`)
 *   so the acquire / work sequence all runs on the same connection.
 *
 * Usage:
 *   await db.transaction(async (tx) => {
 *     const lock = new AdvisoryLock(tx, BigInt(0x42_4f_42_53));
 *     if (await lock.acquire()) {
 *       // critical section — lock auto-releases on tx commit/rollback
 *     }
 *   });
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
      sql`SELECT pg_try_advisory_xact_lock(${this.key}::int8) AS "locked"`,
    );
    const row = result.rows[0] as { locked?: unknown } | undefined;
    this.acquired = row?.locked === true;
    return this.acquired;
  }
}
