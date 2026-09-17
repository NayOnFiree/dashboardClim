import "server-only";

import { Pool } from "pg";

declare global {
  var climPilotPool: Pool | undefined;
}

function createPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL n'est pas configuree.");
  }

  return new Pool({
    connectionString: process.env.DATABASE_URL,
    application_name: "clim-pilot-web",
    max: 10,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
  });
}

export const database = global.climPilotPool ?? createPool();

if (process.env.NODE_ENV !== "production") global.climPilotPool = database;
