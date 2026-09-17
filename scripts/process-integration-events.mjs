import { createHmac } from "node:crypto";
import pg from "pg";
import { loadLocalEnv } from "./load-local-env.mjs";

await loadLocalEnv();

const required = ["DATABASE_URL", "N8N_WEBHOOK_URL", "INTEGRATION_WEBHOOK_SECRET"];
for (const name of required) if (!process.env[name]) throw new Error(`${name} n'est pas configuree.`);

const batchSize = Math.max(1, Math.min(100, Number(process.env.INTEGRATION_BATCH_SIZE ?? 20)));
const maxAttempts = Math.max(1, Number(process.env.INTEGRATION_MAX_ATTEMPTS ?? 8));
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, application_name: "clim-pilot-outbox", connectionTimeoutMillis: 10_000 });

function signature(payload) {
  return createHmac("sha256", process.env.INTEGRATION_WEBHOOK_SECRET).update(payload).digest("hex");
}

async function claimEvents() {
  await client.query("BEGIN");
  try {
    const result = await client.query(`
      WITH candidates AS (
        SELECT id FROM integration_events
        WHERE status = 'pending' AND next_attempt_at <= now()
        ORDER BY created_at
        FOR UPDATE SKIP LOCKED
        LIMIT $1
      )
      UPDATE integration_events event
      SET status = 'processing', locked_at = now()
      FROM candidates WHERE event.id = candidates.id
      RETURNING event.id, event.organization_id, event.event_type, event.entity_id,
        event.payload, event.attempts, event.created_at
    `, [batchSize]);
    await client.query("COMMIT");
    return result.rows;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function dispatch(event) {
  const envelope = JSON.stringify({
    id: event.id, type: event.event_type, organizationId: event.organization_id,
    entityId: event.entity_id, occurredAt: event.created_at, data: event.payload,
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(process.env.N8N_WEBHOOK_URL, {
      method: "POST", signal: controller.signal,
      headers: { "content-type": "application/json", "x-clim-event-id": event.id, "x-clim-signature": `sha256=${signature(envelope)}` },
      body: envelope,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await client.query("UPDATE integration_events SET status = 'processed', attempts = attempts + 1, processed_at = now(), locked_at = null, last_error = null WHERE id = $1", [event.id]);
    console.log(`traite             ${event.id} ${event.event_type}`);
  } catch (error) {
    const attempts = Number(event.attempts) + 1;
    const dead = attempts >= maxAttempts;
    const delaySeconds = Math.min(3600, 30 * (2 ** Math.max(0, attempts - 1)));
    const message = error instanceof Error ? error.message.slice(0, 500) : "Erreur inconnue";
    await client.query(`UPDATE integration_events SET status = $2, attempts = $3, last_error = $4,
      next_attempt_at = now() + ($5 * interval '1 second'), locked_at = null WHERE id = $1`,
    [event.id, dead ? "dead" : "pending", attempts, message, delaySeconds]);
    console.error(`${dead ? "abandon" : "nouvel essai"}     ${event.id} ${message}`);
  } finally { clearTimeout(timeout); }
}

try {
  await client.connect();
  const stale = await client.query("UPDATE integration_events SET status = 'pending', locked_at = null WHERE status = 'processing' AND locked_at < now() - interval '5 minutes'");
  if (stale.rowCount) console.log(`verrous recuperes  ${stale.rowCount}`);
  const events = await claimEvents();
  if (!events.length) console.log("aucun evenement a traiter");
  for (const event of events) await dispatch(event);
} finally { await client.end(); }
