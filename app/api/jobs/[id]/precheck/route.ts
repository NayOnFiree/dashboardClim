import { getCurrentUser } from "@/lib/auth/session";
import { database } from "@/lib/db";

const allowedAnswers: Record<string, string[]> = {
  starts: ["Oui", "Non", "Non testé"],
  error: ["Oui", "Non"],
  leak: ["Oui", "Non", "Traces"],
  noise: ["Oui", "Non"],
  damage: ["Oui", "Non"],
  access: ["Oui", "Non"],
};

type PrecheckPayload = {
  equipmentId?: unknown;
  answers?: unknown;
  notes?: unknown;
  safety?: unknown;
};

function validatePayload(payload: PrecheckPayload) {
  if (typeof payload.equipmentId !== "string" || !payload.equipmentId) return "Equipement manquant.";
  if (!payload.answers || typeof payload.answers !== "object" || Array.isArray(payload.answers)) return "Reponses invalides.";
  if (!payload.notes || typeof payload.notes !== "object" || Array.isArray(payload.notes)) return "Observations invalides.";
  if (payload.safety !== true) return "La confirmation de securite est obligatoire.";

  const answers = payload.answers as Record<string, unknown>;
  const notes = payload.notes as Record<string, unknown>;
  for (const [question, options] of Object.entries(allowedAnswers)) {
    if (typeof answers[question] !== "string" || !options.includes(answers[question])) return `Reponse invalide pour ${question}.`;
  }

  const anomalyQuestions = [
    answers.starts !== "Oui" ? "starts" : null,
    answers.error === "Oui" ? "error" : null,
    answers.leak === "Oui" || answers.leak === "Traces" ? "leak" : null,
    answers.noise === "Oui" ? "noise" : null,
    answers.damage === "Oui" ? "damage" : null,
    answers.access === "Non" ? "access" : null,
  ].filter((value): value is string => Boolean(value));

  for (const question of anomalyQuestions) {
    if (typeof notes[question] !== "string" || notes[question].trim().length < 3) return `Une observation est obligatoire pour ${question}.`;
  }
  return { answers, notes, anomalyCount: anomalyQuestions.length };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentification requise." }, { status: 401 });
  if (user.role !== "technician" && user.role !== "subcontractor") return Response.json({ error: "Acces refuse." }, { status: 403 });

  let payload: PrecheckPayload;
  try {
    payload = await request.json() as PrecheckPayload;
  } catch {
    return Response.json({ error: "Corps de requete invalide." }, { status: 400 });
  }

  const validation = validatePayload(payload);
  if (typeof validation === "string") return Response.json({ error: validation }, { status: 400 });
  const { id: publicCode } = await params;
  const client = await database.connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.organization_id', $1, true)", [user.organizationId]);
    const job = await client.query<{ id: string }>(`
      SELECT j.id
      FROM jobs j
      JOIN job_equipment je ON je.job_id = j.id
      WHERE j.public_code = $1
        AND j.organization_id = $2
        AND j.primary_technician_id = $3
        AND je.equipment_id = $4
      LIMIT 1
      FOR UPDATE OF j
    `, [publicCode, user.organizationId, user.id, payload.equipmentId]);
    if (!job.rowCount) {
      await client.query("ROLLBACK");
      return Response.json({ error: "Intervention ou equipement introuvable." }, { status: 404 });
    }

    await client.query(`
      INSERT INTO job_prechecks (
        organization_id, job_id, equipment_id, answers, notes,
        safety_confirmed, anomaly_count, completed_by
      ) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, true, $6, $7)
      ON CONFLICT (job_id, equipment_id) DO UPDATE SET
        answers = EXCLUDED.answers,
        notes = EXCLUDED.notes,
        safety_confirmed = EXCLUDED.safety_confirmed,
        anomaly_count = EXCLUDED.anomaly_count,
        completed_by = EXCLUDED.completed_by,
        completed_at = now(),
        updated_at = now()
    `, [user.organizationId, job.rows[0].id, payload.equipmentId, JSON.stringify(validation.answers), JSON.stringify(validation.notes), validation.anomalyCount, user.id]);
    await client.query(`
      INSERT INTO audit_logs (organization_id, actor_id, entity_type, entity_id, action, after_json)
      VALUES ($1, $2, 'job', $3, 'precheck.completed', $4::jsonb)
    `, [user.organizationId, user.id, job.rows[0].id, JSON.stringify({ equipmentId: payload.equipmentId, anomalyCount: validation.anomalyCount })]);
    await client.query(`
      INSERT INTO integration_events (organization_id, event_type, entity_id, payload)
      VALUES ($1, 'job.precheck_completed', $2, $3::jsonb)
    `, [user.organizationId, job.rows[0].id, JSON.stringify({ jobId: job.rows[0].id, equipmentId: payload.equipmentId, technicianId: user.id, anomalyCount: validation.anomalyCount })]);
    await client.query("COMMIT");
    return Response.json({ saved: true, anomalyCount: validation.anomalyCount });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("Echec de l'enregistrement du pre-controle.", error);
    return Response.json({ error: "Le pre-controle n'a pas pu etre enregistre." }, { status: 500 });
  } finally {
    client.release();
  }
}
