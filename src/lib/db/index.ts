import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import * as schema from './schema';

// `neon-serverless` uses websockets in Node; ensure the websocket constructor exists.
neonConfig.webSocketConstructor = ws;

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (!_db) {
    if (!process.env['DATABASE_URL']) {
      throw new Error('DATABASE_URL is not set');
    }
    const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
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
