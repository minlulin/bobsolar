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

if (!process.env["DATABASE_URL"]) {
  throw new Error("DATABASE_URL is not set");
}

const pool = new Pool({
  connectionString: process.env["DATABASE_URL"],
  connectionTimeoutMillis: 15_000, // 15s for Neon cold-start wake-up
});

// Synchronous initialization
export const db = drizzle(pool, { schema });

// Backward compatibility for files that already use await getDb()
export async function getDb(): Promise<ReturnType<typeof drizzle<typeof schema>>> {
  return db;
}
