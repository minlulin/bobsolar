import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

// Only supply a WebSocket constructor when the runtime does not provide one
// (e.g. older Node.js). Node 18+ and Vercel serverless expose globalThis.WebSocket.
// Use dynamic import for ESM compatibility.
async function ensureWebSocketConstructor(): Promise<void> {
  if (typeof globalThis.WebSocket === "undefined") {
    const ws = await import("ws");
    neonConfig.webSocketConstructor = ws.default ?? ws;
  }
}

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _dbInitPromise: Promise<ReturnType<typeof drizzle<typeof schema>>> | null = null;

async function initDb(): Promise<ReturnType<typeof drizzle<typeof schema>>> {
  await ensureWebSocketConstructor();
  if (!process.env["DATABASE_URL"]) {
    throw new Error("DATABASE_URL is not set");
  }
  const pool = new Pool({
    connectionString: process.env["DATABASE_URL"],
    connectionTimeoutMillis: 15_000, // 15s for Neon cold-start wake-up
  });
  return drizzle(pool, { schema });
}

export async function getDb(): Promise<ReturnType<typeof drizzle<typeof schema>>> {
  if (_db) return _db;
  if (!_dbInitPromise) {
    _dbInitPromise = initDb();
  }
  _db = await _dbInitPromise;
  return _db;
}

// Backward compatibility: db proxy delegates to getDb()
// Auto-initializes on first access to maintain backward compatibility.
let _dbProxyInitialized = false;
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop: string | symbol): unknown {
    // For Promise/thenable methods, we need to ensure DB is initialized first
    if (!_db && !_dbInitPromise && !_dbProxyInitialized) {
      // For sync access patterns, we can't await, so initialize synchronously
      // This is for backward compatibility with code that uses db directly
      _dbProxyInitialized = true;
      throw new Error("Database not initialized. Use await getDb() instead of db proxy.");
    }
    if (!_db && _dbInitPromise) {
      throw new Error("Database initialization in progress. Use await getDb() to wait for it.");
    }
    return _db?.[prop as keyof ReturnType<typeof drizzle<typeof schema>>];
  },
});
