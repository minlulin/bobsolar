import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool, neonConfig } from '@neondatabase/serverless';
import * as schema from './schema';
import { getDatabaseUrl } from './database-url';

// Vercel runs on modern Node with a native WebSocket implementation. Using it
// avoids bundling ws' optional native mask helpers into serverless functions.
if (typeof WebSocket !== 'undefined') {
  neonConfig.webSocketConstructor = WebSocket;
}

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (!_db) {
    const pool = new Pool({ connectionString: getDatabaseUrl() });
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
