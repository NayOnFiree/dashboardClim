import { getCurrentUser } from "@/lib/auth/session";
import { database } from "@/lib/db";

const allowedAnswers: Record<string, string[]> = {
  starts: ["Oui", "Non"], fan: ["Oui", "Non"], louvers: ["Oui", "Non", "Non applicable"],
  no_error: ["Oui", "Non"], no_leak: ["Oui", "Non"], no_noise: ["Oui", "Non"], clean_area: ["Oui", "Non"],
};
const labels: Record<string, string> = {
  starts: "redémarrage", fan: "ventilation", louvers: "volets", no_error: "code erreur",
  no_leak: "fuite", no_noise: "bruit", clean_area: "propreté de la zone",
};
type CheckPayload = { equipmentId?: unknown; answers?: unknown; notes?: unknown };

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentification requise." }, { status: 401 });
  if (user.role !== "technician" && user.role !== "subcontractor") return Response.json({ error: "Accès refusé." }, { status: 403 });
  let payload: { checks?: CheckPayload[] };
  try { payload = await request.json() as { checks?: CheckPayload[] }; } catch { return Response.json({ error: "Corps de requête invalide." }, { status: 400 }); }
  if (!Array.isArray(payload.checks)) return Response.json({ error: "Contrôles manquants." }, { status: 400 });

  const { id: publicCode } = await params;
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.organization_id', $1, true)", [user.organizationId]);
    const jobResult = await client.query<{ id: string }>(`
      SELECT id FROM jobs WHERE public_code = $1 AND organization_id = $2 AND primary_technician_id = $3
      LIMIT 1 FOR UPDATE
    `, [publicCode, user.organizationId, user.id]);
    if (!jobResult.rowCount) { await client.query("ROLLBACK"); return Response.json({ error: "Intervention introuvable." }, { status: 404 }); }
    const jobId = jobResult.rows[0].id;
    const equipmentResult = await client.query<{ equipment_id: string; before_count: string; after_count: string; response_count: string }>(`
      SELECT je.equipment_id,
        count(DISTINCT photo.photo_type) FILTER (WHERE photo.active = true AND photo.photo_type IN ('before_overview','before_environment','model_label','before_filters'))::text AS before_count,
        count(DISTINCT photo.photo_type) FILTER (WHERE photo.active = true AND photo.photo_type IN ('after_overview','after_environment','after_filters'))::text AS after_count,
        count(DISTINCT response.item_id)::text AS response_count
      FROM job_equipment je
      LEFT JOIN photos photo ON photo.job_id = je.job_id AND photo.equipment_id = je.equipment_id
      LEFT JOIN checklist_responses response ON response.job_id = je.job_id AND response.equipment_id = je.equipment_id
      WHERE je.job_id = $1 GROUP BY je.equipment_id ORDER BY min(je.sequence)
    `, [jobId]);
    const snapshotResult = await client.query<{ item_count: number }>("SELECT coalesce(jsonb_array_length(snapshot_json -> 'items'), 0) AS item_count FROM job_checklist_snapshots WHERE job_id = $1", [jobId]);
    const itemCount = snapshotResult.rows[0]?.item_count ?? 0;
    if (!equipmentResult.rowCount || payload.checks.length !== equipmentResult.rowCount) throw new Error("VALIDATION:Un contrôle est requis pour chaque équipement.");
    const equipmentIds = new Set(equipmentResult.rows.map((row) => row.equipment_id));
    if (payload.checks.some((check) => typeof check.equipmentId !== "string" || !equipmentIds.has(check.equipmentId)) || new Set(payload.checks.map((check) => check.equipmentId)).size !== equipmentIds.size) throw new Error("VALIDATION:La liste des équipements est invalide.");
    for (const equipment of equipmentResult.rows) {
      if (Number(equipment.before_count) < 4 || Number(equipment.after_count) < 3 || itemCount === 0 || Number(equipment.response_count) < itemCount) throw new Error("WORKFLOW:Les photos et la checklist doivent être complètes avant le test final.");
    }

    for (const check of payload.checks) {
      const answers = check.answers;
      if (!answers || typeof answers !== "object" || Array.isArray(answers)) throw new Error("VALIDATION:Réponses invalides.");
      const typedAnswers = answers as Record<string, unknown>;
      for (const [code, options] of Object.entries(allowedAnswers)) if (typeof typedAnswers[code] !== "string" || !options.includes(typedAnswers[code])) throw new Error(`VALIDATION:Réponse invalide pour ${labels[code]}.`);
      const failed = Object.entries(typedAnswers).filter(([, answer]) => answer === "Non").map(([code]) => labels[code]);
      if (failed.length && (typeof check.notes !== "string" || check.notes.trim().length < 3)) throw new Error("VALIDATION:Une observation est obligatoire en cas de test négatif.");
      let incidentId: string | null = null;
      if (failed.length) {
        const existing = await client.query<{ id: string }>(`
          SELECT id FROM incidents WHERE job_id = $1 AND equipment_id = $2
            AND incident_type = 'final_test_failed' AND status NOT IN ('resolved','closed_no_action')
          ORDER BY created_at DESC LIMIT 1
        `, [jobId, check.equipmentId]);
        if (existing.rowCount) {
          incidentId = existing.rows[0].id;
          await client.query("UPDATE incidents SET description = $1 WHERE id = $2", [`Test final négatif : ${failed.join(", ")}. ${check.notes}`, incidentId]);
        } else {
          const inserted = await client.query<{ id: string }>(`
            INSERT INTO incidents (organization_id, public_code, job_id, equipment_id, incident_type, moment, severity, status, description, created_by)
            VALUES ($1, concat('INC-', to_char(now(), 'YYYY'), '-', upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))), $2, $3, 'final_test_failed', 'after', 'minor', 'open', $4, $5)
            RETURNING id
          `, [user.organizationId, jobId, check.equipmentId, `Test final négatif : ${failed.join(", ")}. ${check.notes}`, user.id]);
          incidentId = inserted.rows[0].id;
        }
      }
      await client.query(`
        INSERT INTO job_final_checks (organization_id, job_id, equipment_id, answers, notes, passed, incident_id, completed_by)
        VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8)
        ON CONFLICT (job_id, equipment_id) DO UPDATE SET answers = EXCLUDED.answers, notes = EXCLUDED.notes,
          passed = EXCLUDED.passed, incident_id = EXCLUDED.incident_id, completed_by = EXCLUDED.completed_by,
          completed_at = now(), updated_at = now()
      `, [user.organizationId, jobId, check.equipmentId, JSON.stringify(typedAnswers), typeof check.notes === "string" ? check.notes.trim() || null : null, failed.length === 0, incidentId, user.id]);
    }
    await client.query("INSERT INTO audit_logs (organization_id, actor_id, entity_type, entity_id, action, after_json) VALUES ($1, $2, 'job', $3, 'final_check.completed', $4::jsonb)", [user.organizationId, user.id, jobId, JSON.stringify({ equipmentCount: equipmentResult.rowCount })]);
    await client.query("INSERT INTO integration_events (organization_id, event_type, entity_id, payload) VALUES ($1, 'job.final_check_completed', $2, $3::jsonb)", [user.organizationId, jobId, JSON.stringify({ jobId, technicianId: user.id })]);
    await client.query("COMMIT");
    return Response.json({ saved: true });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    if (error instanceof Error && error.message.startsWith("WORKFLOW:")) return Response.json({ error: error.message.slice(9) }, { status: 409 });
    if (error instanceof Error && error.message.startsWith("VALIDATION:")) return Response.json({ error: error.message.slice(11) }, { status: 400 });
    console.error("Échec de l'enregistrement du test final.", error);
    return Response.json({ error: "Le test final n'a pas pu être enregistré." }, { status: 500 });
  } finally { client.release(); }
}
