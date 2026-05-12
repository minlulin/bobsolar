import { defineConfig } from 'drizzle-kit';
import { config } from 'dotenv';
import { neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

config({ path: '.env.local' });

// drizzle-kit runs in Node; neon-serverless requires a websocket constructor.
neonConfig.webSocketConstructor = ws;

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/lib/db/schema.ts',
  out: './drizzle/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
