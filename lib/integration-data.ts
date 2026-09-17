import "server-only";

import { database } from "@/lib/db";

export type IntegrationEvent = { id: string; type: string; status: string; attempts: number; createdAt: string; processedAt?: string; lastError?: string };
export type IntegrationOverview = { pending: number; processing: number; processed: number; dead: number; recent: IntegrationEvent[]; n8nConfigured: boolean };

export async function getIntegrationOverview(organizationId: string): Promise<IntegrationOverview> {
  const client = await database.connect();
  try {
    await client.query("BEGIN READ ONLY");
    await client.query("SELECT set_config('app.organization_id', $1, true)", [organizationId]);
    const [counts, recent] = await Promise.all([
      client.query<{ status: string; count: string }>("SELECT status, count(*)::text AS count FROM integration_events WHERE organization_id = $1 GROUP BY status", [organizationId]),
      client.query<{ id: string; event_type: string; status: string; attempts: number; created_at: string; processed_at: string | null; last_error: string | null }>(`
        SELECT id, event_type, status, attempts,
          to_char(created_at AT TIME ZONE 'Europe/Paris', 'DD/MM/YYYY HH24:MI') AS created_at,
          to_char(processed_at AT TIME ZONE 'Europe/Paris', 'DD/MM/YYYY HH24:MI') AS processed_at,
          last_error FROM integration_events WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 100
      `, [organizationId]),
    ]);
    await client.query("ROLLBACK");
    const totals = Object.fromEntries(counts.rows.map((row) => [row.status, Number(row.count)]));
    return { pending: totals.pending ?? 0, processing: totals.processing ?? 0, processed: totals.processed ?? 0, dead: totals.dead ?? 0, n8nConfigured: Boolean(process.env.N8N_WEBHOOK_URL && process.env.INTEGRATION_WEBHOOK_SECRET), recent: recent.rows.map((row) => ({ id: row.id, type: row.event_type, status: row.status, attempts: row.attempts, createdAt: row.created_at, processedAt: row.processed_at ?? undefined, lastError: row.last_error ?? undefined })) };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("Lecture des integrations impossible.", error);
    return { pending: 0, processing: 0, processed: 0, dead: 0, recent: [], n8nConfigured: false };
  } finally { client.release(); }
}
