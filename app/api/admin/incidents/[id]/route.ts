import { getCurrentUser } from "@/lib/auth/session";
import { database } from "@/lib/db";

const allowedStatuses = new Set(["open", "in_review", "action_required", "resolved", "closed_no_action"]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentification requise." }, { status: 401 });
  if (!["owner", "admin", "operations"].includes(user.role)) return Response.json({ error: "Accès refusé." }, { status: 403 });
  let payload: { status?: unknown; closureOverride?: unknown };
  try { payload = await request.json() as typeof payload; } catch { return Response.json({ error: "Corps de requête invalide." }, { status: 400 }); }
  if (payload.status === undefined && payload.closureOverride === undefined) return Response.json({ error: "Aucune modification fournie." }, { status: 400 });
  if (payload.status !== undefined && (typeof payload.status !== "string" || !allowedStatuses.has(payload.status))) return Response.json({ error: "Statut invalide." }, { status: 400 });
  if (payload.closureOverride !== undefined && typeof payload.closureOverride !== "boolean") return Response.json({ error: "Autorisation de clôture invalide." }, { status: 400 });
  if (payload.closureOverride !== undefined && !["owner", "admin"].includes(user.role)) return Response.json({ error: "Seul un administrateur peut autoriser la clôture." }, { status: 403 });
  const { id } = await params;
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.organization_id', $1, true)", [user.organizationId]);
    const current = await client.query<{ status: string; closure_override: boolean; severity: string; job_id: string }>("SELECT status::text, closure_override, severity::text, job_id FROM incidents WHERE id = $1 AND organization_id = $2 FOR UPDATE", [id, user.organizationId]);
    if (!current.rowCount) { await client.query("ROLLBACK"); return Response.json({ error: "Incident introuvable." }, { status: 404 }); }
    if (payload.closureOverride === true && current.rows[0].severity !== "critical") throw new Error("VALIDATION:L’autorisation exceptionnelle est réservée aux incidents critiques.");
    const nextStatus = typeof payload.status === "string" ? payload.status : current.rows[0].status;
    const nextOverride = typeof payload.closureOverride === "boolean" ? payload.closureOverride : current.rows[0].closure_override;
    await client.query(`
      UPDATE incidents SET status = $1::incident_status, closure_override = $2,
        resolved_by = CASE WHEN $1::incident_status IN ('resolved','closed_no_action') THEN $3::uuid ELSE NULL::uuid END,
        resolved_at = CASE WHEN $1::incident_status IN ('resolved','closed_no_action') THEN now() ELSE NULL END
      WHERE id = $4
    `, [nextStatus, nextOverride, user.id, id]);
    await client.query("INSERT INTO audit_logs (organization_id, actor_id, entity_type, entity_id, action, before_json, after_json) VALUES ($1, $2, 'incident', $3, 'incident.updated', $4::jsonb, $5::jsonb)", [user.organizationId, user.id, id, JSON.stringify({ status: current.rows[0].status, closureOverride: current.rows[0].closure_override }), JSON.stringify({ status: nextStatus, closureOverride: nextOverride })]);
    await client.query("INSERT INTO integration_events (organization_id, event_type, entity_id, payload) VALUES ($1, $2, $3, $4::jsonb)", [user.organizationId, ["resolved", "closed_no_action"].includes(nextStatus) ? "incident.resolved" : "incident.updated", id, JSON.stringify({ incidentId: id, jobId: current.rows[0].job_id, status: nextStatus, closureOverride: nextOverride })]);
    await client.query("COMMIT");
    return Response.json({ saved: true, status: nextStatus, closureOverride: nextOverride });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    if (error instanceof Error && error.message.startsWith("VALIDATION:")) return Response.json({ error: error.message.slice(11) }, { status: 400 });
    console.error("Mise à jour de l'incident impossible.", error);
    return Response.json({ error: "L’incident n'a pas pu être mis à jour." }, { status: 500 });
  } finally { client.release(); }
}
