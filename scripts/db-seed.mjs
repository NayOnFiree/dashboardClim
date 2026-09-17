import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";
import { loadLocalEnv } from "./load-local-env.mjs";

await loadLocalEnv();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL est absente de .env.local");
}

const target = new URL(process.env.DATABASE_URL);
const databaseName = target.pathname.slice(1);
const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(target.hostname);

if (!isLocalHost || !databaseName.endsWith("_dev")) {
  throw new Error("Le seed est limite aux bases locales dont le nom se termine par _dev.");
}

const sql = await readFile(resolve(process.cwd(), "db", "seeds", "001_demo.sql"), "utf8");
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  application_name: "clim-pilot-seed",
  connectionTimeoutMillis: 10_000,
});

try {
  await client.connect();
  await client.query("BEGIN");
  await client.query(sql);
  await client.query("COMMIT");
  console.log("Donnees de demonstration synchronisees dans clim_dev.");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
