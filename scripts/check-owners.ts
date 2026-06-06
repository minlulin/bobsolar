import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local" });

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL ?? process.env.DATABASE_URL_DIRECT;
  if (!url) throw new Error("DATABASE_URL missing");
  const c = new pg.Pool({ connectionString: url, connectionTimeoutMillis: 15_000 });
  try {
    const r = await c.query<{ email: string; ownership_percentage: string; u: { name: string } }>(
      `SELECT u.email, o.ownership_percentage, jsonb_build_object('name', u.name) AS u
       FROM owners o JOIN users u ON u.id = o.user_id ORDER BY u.email`,
    );
    console.log(`Owners: ${r.rowCount}`);
    for (const row of r.rows) {
      console.log(
        `  ${row.u.name.padEnd(15)} ${row.email.padEnd(30)} ${row.ownership_percentage}%`,
      );
    }
  } finally {
    await c.end();
  }
}
void main();
