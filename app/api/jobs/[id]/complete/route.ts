import { getCurrentUser } from "@/lib/auth/session";
import { database } from "@/lib/db";

const paymentMethods: Record<string, string> = {
  paid_card: "card", paid_cash: "cash", paid_transfer: "transfer", pending: "pending", not_required: "invoice",
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentification requise." }, { status: 401 });
  if (user.role !== "technician" && user.role !== "subcontractor") return Response.json({ error: "Accès refusé." }, { status: 403 });
  let payload: { paymentStatus?: unknown; clientInformed?: unknown; reviewAllowed?: unknown };
  try { payload = await request.json() as typeof payload; } catch { return Response.json({ error: "Corps de requête invalide." }, { status: 400 }); }
  if (typeof payload.paymentStatus !== "string" || !paymentMethods[payload.paymentStatus]) return Response.json({ error: "Statut de paiement invalide." }, { status: 400 });
  if (payload.clientInformed !== true || typeof payload.reviewAllowed !== "boolean") return Response.json({ error: "Confirmation client manquante." }, { status: 400 });

  const { id: publicCode } = await params;
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.organization_id', $1, true)", [user.organizationId]);
    const jobResult = await client.query<{ id: string; status: string; price_cents: number; started_at: Date | null }>(`
      SELECT id, status::text, price_cents, started_at FROM jobs
      WHERE public_code = $1 AND organization_id = $2 AND primary_technician_id = $3
      LIMIT 1 FOR UPDATE
    `, [publicCode, user.organizationId, user.id]);
    if (!jobResult.rowCount) { await client.query("ROLLBACK"); return Response.json({ error: "Intervention introuvable." }, { status: 404 }); }
    const job = jobResult.rows[0];
    if (["completed", "completed_pending_payment"].includes(job.status)) { await client.query("COMMIT"); return Response.json({ saved: true, alreadyCompleted: true }); }
    if (!job.started_at) throw new Error("WORKFLOW:L’intervention doit être démarrée avant sa clôture.");

    const equipment = await client.query<{ equipment_id: string; before_count: string; after_count: string; response_count: string; final_count: string; precheck_count: string }>(`
      SELECT je.equipment_id,
        count(DISTINCT photo.photo_type) FILTER (WHERE photo.active = true AND photo.photo_type IN ('before_overview','before_environment','model_label','before_filters'))::text AS before_count,
        count(DISTINCT photo.photo_type) FILTER (WHERE photo.active = true AND photo.photo_type IN ('after_overview','after_environment','after_filters'))::text AS after_count,
        count(DISTINCT response.item_id)::text AS response_count,
        count(DISTINCT final.id)::text AS final_count,
        count(DISTINCT precheck.id)::text AS precheck_count
      FROM job_equipment je
      LEFT JOIN photos photo ON photo.job_id = je.job_id AND photo.equipment_id = je.equipment_id
      LEFT JOIN checklist_responses response ON response.job_id = je.job_id AND response.equipment_id = je.equipment_id
      LEFT JOIN job_final_checks final ON final.job_id = je.job_id AND final.equipment_id = je.equipment_id
      LEFT JOIN job_prechecks precheck ON precheck.job_id = je.job_id AND precheck.equipment_id = je.equipment_id
      WHERE je.job_id = $1 GROUP BY je.equipment_id
    `, [job.id]);
    const snapshot = await client.query<{ item_count: number }>("SELECT coalesce(jsonb_array_length(snapshot_json -> 'items'), 0) AS item_count FROM job_checklist_snapshots WHERE job_id = $1", [job.id]);
    const itemCount = snapshot.rows[0]?.item_count ?? 0;
    if (!equipment.rowCount || equipment.rows.some((entry) => Number(entry.precheck_count) < 1 || Number(entry.before_count) < 4 || Number(entry.after_count) < 3 || itemCount === 0 || Number(entry.response_count) < itemCount || Number(entry.final_count) < 1)) throw new Error("WORKFLOW:Le parcours terrain est incomplet pour au moins un équipement.");
    const critical = await client.query("SELECT 1 FROM incidents WHERE job_id = $1 AND severity = 'critical' AND status NOT IN ('resolved','closed_no_action') AND closure_override = false LIMIT 1", [job.id]);
    if (critical.rowCount) throw new Error("WORKFLOW:Un incident critique ouvert bloque la clôture.");

    await client.query("INSERT INTO payments (organization_id, job_id, method, status, amount_cents, paid_at) VALUES ($1, $2, $3, $4, $5, CASE WHEN $4 IN ('paid_card','paid_cash','paid_transfer') THEN now() ELSE NULL END)", [user.organizationId, job.id, paymentMethods[payload.paymentStatus], payload.paymentStatus, job.price_cents]);
    await client.query("INSERT INTO job_completion_details (job_id, organization_id, client_informed, review_allowed, completed_by) VALUES ($1, $2, true, $3, $4) ON CONFLICT (job_id) DO UPDATE SET client_informed = true, review_allowed = EXCLUDED.review_allowed, completed_by = EXCLUDED.completed_by, completed_at = now()", [job.id, user.organizationId, payload.reviewAllowed, user.id]);
    const finalStatus = payload.paymentStatus === "pending" ? "completed_pending_payment" : "completed";
    await client.query("UPDATE jobs SET status = $1, payment_status = $2, completed_at = now() WHERE id = $3", [finalStatus, payload.paymentStatus, job.id]);
    await client.query("UPDATE job_equipment SET status = 'completed', completed_at = now() WHERE job_id = $1", [job.id]);
    await client.query("INSERT INTO audit_logs (organization_id, actor_id, entity_type, entity_id, action, after_json) VALUES ($1, $2, 'job', $3, 'job.completed', $4::jsonb)", [user.organizationId, user.id, job.id, JSON.stringify({ status: finalStatus, paymentStatus: payload.paymentStatus, reviewAllowed: payload.reviewAllowed })]);
    await client.query("INSERT INTO integration_events (organization_id, event_type, entity_id, payload) VALUES ($1, 'job.completed', $2, $3::jsonb)", [user.organizationId, job.id, JSON.stringify({ jobId: job.id, technicianId: user.id, equipmentCount: equipment.rowCount, amountCents: job.price_cents, reviewAllowed: payload.reviewAllowed })]);
    await client.query("COMMIT");
    return Response.json({ saved: true, status: finalStatus });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    if (error instanceof Error && error.message.startsWith("WORKFLOW:")) return Response.json({ error: error.message.slice(9) }, { status: 409 });
    console.error("Échec de la clôture de l'intervention.", error);
    return Response.json({ error: "L’intervention n'a pas pu être clôturée." }, { status: 500 });
  } finally { client.release(); }
}
