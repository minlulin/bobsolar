import { defineConfig } from 'drizzle-kit';
import { config } from 'dotenv';

config({ path: '.env.local' });

const testDatabaseUrl = process.env['TEST_DATABASE_URL']?.trim();

if (!testDatabaseUrl) {
  throw new Error(
    'TEST_DATABASE_URL is not set. Add it to .env.local for test database migrations.',
  );
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/lib/db/schema.ts',
  out: './drizzle/migrations',
  dbCredentials: {
    url: testDatabaseUrl,
  },
  verbose: true,
  strict: true,
});
