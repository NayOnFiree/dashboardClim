import { getCurrentUser } from "@/lib/auth/session";
import type { ChecklistValue, ServiceChecklistItem } from "@/lib/checklist-data";
import { database } from "@/lib/db";

type Payload = { responses?: Array<{ itemId?: unknown; value?: unknown; reason?: unknown }> };
type Snapshot = { items: ServiceChecklistItem[] };

function validateResponse(item: ServiceChecklistItem, value: unknown, reason: unknown, productIds: Set<string>) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "Réponse invalide.";
  const typed = value as ChecklistValue;
  if (item.responseType === "product") {
    if (typeof typed.productId !== "string" || !productIds.has(typed.productId)) return "Produit invalide.";
    if (!Number.isInteger(typed.quantityMl) || Number(typed.quantityMl) < 1 || Number(typed.quantityMl) > 5000) return "Quantité de produit invalide.";
  } else {
    if (typeof typed.answer !== "string" || !item.options.includes(typed.answer)) return "Choix invalide.";
    if (item.requiredOrReason && typed.answer !== "Fait" && (typeof reason !== "string" || reason.trim().length < 3)) return "Une justification est obligatoire.";
  }
  return undefined;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string; equipmentId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentification requise." }, { status: 401 });
  if (user.role !== "technician" && user.role !== "subcontractor") return Response.json({ error: "Accès refusé." }, { status: 403 });
  let payload: Payload;
  try { payload = await request.json() as Payload; } catch { return Response.json({ error: "Corps de requête invalide." }, { status: 400 }); }
  if (!Array.isArray(payload.responses)) return Response.json({ error: "Réponses manquantes." }, { status: 400 });

  const { id: publicCode, equipmentId } = await params;
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.organization_id', $1, true)", [user.organizationId]);
    const jobResult = await client.query<{ id: string; snapshot_json: Snapshot }>(`
      SELECT j.id, snapshot.snapshot_json
      FROM jobs j
      JOIN job_equipment je ON je.job_id = j.id AND je.equipment_id = $4
      JOIN job_checklist_snapshots snapshot ON snapshot.job_id = j.id
      WHERE j.public_code = $1 AND j.organization_id = $2 AND j.primary_technician_id = $3
      LIMIT 1 FOR UPDATE OF j, je
    `, [publicCode, user.organizationId, user.id, equipmentId]);
    if (!jobResult.rowCount) {
      await client.query("ROLLBACK");
      return Response.json({ error: "Intervention, équipement ou checklist introuvable." }, { status: 404 });
    }
    const job = jobResult.rows[0];
    const beforePhotos = await client.query<{ count: string }>(`
      SELECT count(DISTINCT photo_type)::text AS count FROM photos
      WHERE job_id = $1 AND equipment_id = $2 AND active = true
        AND photo_type IN ('before_overview','before_environment','model_label','before_filters')
    `, [job.id, equipmentId]);
    if (Number(beforePhotos.rows[0].count) < 4) throw new Error("WORKFLOW:Les quatre photos avant sont requises avant de valider le nettoyage.");
    const snapshotItems = job.snapshot_json.items;
    const submitted = new Map(payload.responses.map((response) => [response.itemId, response]));
    const products = await client.query<{ id: string }>("SELECT id FROM products WHERE organization_id = $1 AND active = true", [user.organizationId]);
    const productIds = new Set(products.rows.map((product) => product.id));
    for (const item of snapshotItems) {
      const response = submitted.get(item.id);
      if (!response && item.required) throw new Error(`VALIDATION:Réponse manquante pour « ${item.label} ».`);
      if (!response) continue;
      const validationError = validateResponse(item, response.value, response.reason, productIds);
      if (validationError) throw new Error(`VALIDATION:${validationError} (${item.label})`);
    }
    if (payload.responses.some((response) => typeof response.itemId !== "string" || !snapshotItems.some((item) => item.id === response.itemId))) throw new Error("VALIDATION:La checklist contient une opération inconnue.");

    for (const item of snapshotItems) {
      const response = submitted.get(item.id);
      if (!response) continue;
      await client.query(`
        INSERT INTO checklist_responses (job_id, equipment_id, item_id, value_json, reason, user_id)
        VALUES ($1, $2, $3, $4::jsonb, $5, $6)
        ON CONFLICT (job_id, equipment_id, item_id) DO UPDATE SET
          value_json = EXCLUDED.value_json, reason = EXCLUDED.reason,
          user_id = EXCLUDED.user_id, answered_at = now()
      `, [job.id, equipmentId, item.id, JSON.stringify(response.value), typeof response.reason === "string" ? response.reason.trim() || null : null, user.id]);
    }
    await client.query("DELETE FROM product_usage WHERE job_id = $1 AND equipment_id = $2", [job.id, equipmentId]);
    for (const item of snapshotItems.filter((entry) => entry.responseType === "product")) {
      const value = submitted.get(item.id)?.value as ChecklistValue | undefined;
      if (value?.productId) await client.query("INSERT INTO product_usage (job_id, equipment_id, product_id, quantity_ml) VALUES ($1, $2, $3, $4)", [job.id, equipmentId, value.productId, value.quantityMl]);
    }
    await client.query("UPDATE job_equipment SET status = 'in_progress', started_at = coalesce(started_at, now()) WHERE job_id = $1 AND equipment_id = $2", [job.id, equipmentId]);
    await client.query("INSERT INTO audit_logs (organization_id, actor_id, entity_type, entity_id, action, after_json) VALUES ($1, $2, 'job', $3, 'checklist.completed', $4::jsonb)", [user.organizationId, user.id, job.id, JSON.stringify({ equipmentId, responseCount: snapshotItems.length })]);
    await client.query("INSERT INTO integration_events (organization_id, event_type, entity_id, payload) VALUES ($1, 'job.checklist_completed', $2, $3::jsonb)", [user.organizationId, job.id, JSON.stringify({ jobId: job.id, equipmentId, technicianId: user.id })]);
    await client.query("COMMIT");
    return Response.json({ saved: true });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    if (error instanceof Error && error.message.startsWith("WORKFLOW:")) return Response.json({ error: error.message.slice(9) }, { status: 409 });
    if (error instanceof Error && error.message.startsWith("VALIDATION:")) return Response.json({ error: error.message.slice(11) }, { status: 400 });
    console.error("Échec de l'enregistrement de la checklist.", error);
    return Response.json({ error: "La checklist n'a pas pu être enregistrée." }, { status: 500 });
  } finally { client.release(); }
}
