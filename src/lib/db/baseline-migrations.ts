import { config as loadEnvFile } from 'dotenv';
import { neonConfig, Pool } from '@neondatabase/serverless';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import ws from 'ws';
import { getDatabaseUrl } from './database-url';

type MigrationRow = {
  id: number;
  hash: string;
  created_at: string | number | null;
};

async function main(): Promise<void> {
  loadEnvFile({ path: '.env.local' });
  neonConfig.webSocketConstructor = ws;

  const pool = new Pool({ connectionString: getDatabaseUrl() });

  try {
    await pool.query('CREATE SCHEMA IF NOT EXISTS drizzle');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `);

    const existingResult = await pool.query<MigrationRow>(
      'SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at DESC, id DESC',
    );

    if (existingResult.rowCount !== 0) {
      console.log(
        `Skipping baseline: drizzle.__drizzle_migrations already has ${existingResult.rowCount} row(s).`,
      );
      return;
    }

    const migrationFiles = readMigrationFiles({
      migrationsFolder: 'drizzle/migrations',
    });
    if (migrationFiles.length === 0) {
      console.log('No local migration files found; nothing to baseline.');
      return;
    }

    await pool.query('BEGIN');
    for (const migration of migrationFiles) {
      await pool.query(
        'INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)',
        [migration.hash, String(migration.folderMillis)],
      );
    }
    await pool.query('COMMIT');

    console.log(
      `Inserted ${migrationFiles.length} migration record(s) into drizzle.__drizzle_migrations.`,
    );
  } catch (error: unknown) {
    await pool.query('ROLLBACK');
    if (error instanceof Error) {
      throw new Error(`Failed to baseline migrations: ${error.message}`);
    }
    throw new Error('Failed to baseline migrations due to an unknown error.');
  } finally {
    await pool.end();
  }
}

void main();
