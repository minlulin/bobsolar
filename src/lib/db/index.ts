import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

// Node 18+ and Vercel serverless expose globalThis.WebSocket.
if (typeof globalThis.WebSocket === "undefined") {
  // Fallback for older Node.js testing environments
  (async () => {
    const ws = await import("ws");
    neonConfig.webSocketConstructor = ws.default ?? ws;
  })();
}

type Schema = typeof schema;
type DbInstance = ReturnType<typeof drizzle<Schema>>;

let dbInstance: DbInstance | null = null;

function getPool(): Pool {
  if (!process.env["DATABASE_URL"]) {
    throw new Error("DATABASE_URL is not set");
  }
  return new Pool({
    connectionString: process.env["DATABASE_URL"],
    connectionTimeoutMillis: 15_000, // 15s for Neon cold-start wake-up
  });
}

function initDb(): DbInstance {
  if (!dbInstance) {
    const pool = getPool();
    dbInstance = drizzle(pool, { schema });
  }
  return dbInstance;
}

/**
 * Lazy proxy for `db` – the pool and drizzle instance are NOT created at
 * module-import time. They are initialised on the first property access.
 *
 * This avoids a top-level throw when `DATABASE_URL` is absent (CI, test
 * suites that mock the DB, etc.). Tests that mock `@/lib/db` will never
 * trigger the real proxy; tests that need a real connection will call a
 * method on `db` and get a clear "DATABASE_URL is not set" error at that
 * point.
 */
const handler: ProxyHandler<DbInstance> = {
  get(_target, prop: string | symbol) {
    return Reflect.get(initDb(), prop, initDb());
  },
  set(_target, prop: string | symbol, value: unknown) {
    Reflect.set(initDb(), prop, value);
    return true;
  },
  has(_target, prop: string | symbol) {
    return prop in initDb();
  },
  ownKeys() {
    return Reflect.ownKeys(initDb());
  },
  getOwnPropertyDescriptor(_target, prop: string | symbol) {
    return Object.getOwnPropertyDescriptor(initDb(), prop);
  },
};

export const db = new Proxy<DbInstance>({} as DbInstance, handler);
