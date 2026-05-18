import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

// Only supply a WebSocket constructor when the runtime does not provide one
// (e.g. older Node.js). Node 18+ and Vercel serverless expose globalThis.WebSocket.
// We use a lazy require() rather than a top-level ESM import so that Next.js'
// serverExternalPackages can properly exclude 'ws' from the bundle, avoiding
// cryptic native-addon failures like 'b.mask is not a function' on Vercel.
if (typeof globalThis.WebSocket === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ws = require("ws") as typeof import("ws") & {
    default?: typeof import("ws");
  };
  neonConfig.webSocketConstructor = ws.default ?? ws;
}

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (!_db) {
    if (!process.env["DATABASE_URL"]) {
      throw new Error("DATABASE_URL is not set");
    }
    const pool = new Pool({
      connectionString: process.env["DATABASE_URL"],
      connectionTimeoutMillis: 15_000, // 15s for Neon cold-start wake-up
    });
    _db = drizzle(pool, { schema });
  }
  return _db;
}

// Backward compatibility: db proxy delegates to getDb()
export const db = new Proxy({} as ReturnType<typeof getDb>, {
  get(_target, prop: string | symbol): unknown {
    return getDb()[prop as keyof ReturnType<typeof getDb>];
  },
});
