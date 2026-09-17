import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";
import { loadLocalEnv } from "./load-local-env.mjs";

await loadLocalEnv();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL est absente de .env.local");
}

const migrationsDirectory = resolve(process.cwd(), "db", "migrations");
const migrationFiles = (await readdir(migrationsDirectory))
  .filter((file) => file.endsWith(".sql"))
  .sort();

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  application_name: "clim-pilot-migrations",
  connectionTimeoutMillis: 10_000,
});
let connected = false;

try {
  await client.connect();
  connected = true;
  await client.query("SELECT pg_advisory_lock(hashtext('clim-pilot-migrations'))");
  await client.query(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      name text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  for (const file of migrationFiles) {
    const sql = await readFile(resolve(migrationsDirectory, file), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const existing = await client.query(
      "SELECT checksum FROM app_migrations WHERE name = $1",
      [file],
    );

    if (existing.rowCount) {
      if (existing.rows[0].checksum !== checksum) {
        throw new Error(`La migration deja appliquee ${file} a ete modifiee.`);
      }
      console.log(`deja appliquee  ${file}`);
      continue;
    }

    console.log(`application       ${file}`);
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query(
        "INSERT INTO app_migrations (name, checksum) VALUES ($1, $2)",
        [file, checksum],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
    console.log(`terminee          ${file}`);
  }
} finally {
  if (connected) {
    await client.query("SELECT pg_advisory_unlock(hashtext('clim-pilot-migrations'))");
  }
  await client.end();
}
