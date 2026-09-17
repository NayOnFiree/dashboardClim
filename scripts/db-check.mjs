import pg from "pg";
import { loadLocalEnv } from "./load-local-env.mjs";

await loadLocalEnv();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL est absente de .env.local");
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  application_name: "clim-pilot-db-check",
  connectionTimeoutMillis: 10_000,
});

try {
  await client.connect();
  await client.query("BEGIN READ ONLY");

  const info = await client.query(`
    SELECT
      current_database() AS database_name,
      current_user AS database_user,
      current_setting('server_version') AS server_version
  `);
  const tables = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);

  await client.query("ROLLBACK");

  console.log(JSON.stringify({
    connected: true,
    database: info.rows[0].database_name,
    user: info.rows[0].database_user,
    serverVersion: info.rows[0].server_version,
    tableCount: tables.rowCount,
    tables: tables.rows.map((row) => row.table_name),
  }, null, 2));
} finally {
  await client.end();
}
