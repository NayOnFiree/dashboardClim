import { getCurrentUser } from "@/lib/auth/session";
import { database } from "@/lib/db";

type Payload = {
  siteId?: unknown; technicianId?: unknown; equipmentIds?: unknown; scheduledStart?: unknown;
  scheduledEnd?: unknown; serviceType?: unknown; priceCents?: unknown; notes?: unknown;
};

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentification requise." }, { status: 401 });
  if (!["owner", "admin", "operations"].includes(user.role)) return Response.json({ error: "Accès refusé." }, { status: 403 });
  let payload: Payload;
  try { payload = await request.json() as Payload; } catch { return Response.json({ error: "Corps de requête invalide." }, { status: 400 }); }
  if (typeof payload.siteId !== "string" || !payload.siteId) return Response.json({ error: "Site obligatoire." }, { status: 400 });
  if (!Array.isArray(payload.equipmentIds) || payload.equipmentIds.length < 1 || payload.equipmentIds.length > 20 || payload.equipmentIds.some((id) => typeof id !== "string") || new Set(payload.equipmentIds).size !== payload.equipmentIds.length) return Response.json({ error: "Sélectionnez entre 1 et 20 équipements distincts." }, { status: 400 });
  if (payload.technicianId !== null && typeof payload.technicianId !== "string") return Response.json({ error: "Technicien invalide." }, { status: 400 });
  if (payload.serviceType !== "maintenance" && payload.serviceType !== "deep_clean") return Response.json({ error: "Prestation invalide." }, { status: 400 });
  if (!Number.isInteger(payload.priceCents) || Number(payload.priceCents) < 0 || Number(payload.priceCents) > 10_000_000) return Response.json({ error: "Prix invalide." }, { status: 400 });
  if (typeof payload.notes !== "string" || payload.notes.length > 2000) return Response.json({ error: "Notes invalides." }, { status: 400 });
  if (typeof payload.scheduledStart !== "string" || typeof payload.scheduledEnd !== "string") return Response.json({ error: "Créneau obligatoire." }, { status: 400 });
  const scheduledStart = new Date(payload.scheduledStart); const scheduledEnd = new Date(payload.scheduledEnd);
  if (!Number.isFinite(scheduledStart.getTime()) || !Number.isFinite(scheduledEnd.getTime()) || scheduledEnd <= scheduledStart) return Response.json({ error: "Le créneau horaire est invalide." }, { status: 400 });
  if (scheduledEnd.getTime() - scheduledStart.getTime() > 12 * 60 * 60 * 1000) return Response.json({ error: "Une intervention ne peut pas dépasser 12 heures." }, { status: 400 });

  const client = await database.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.organization_id', $1, true)", [user.organizationId]);
    const site = await client.query("SELECT 1 FROM sites WHERE id = $1 AND organization_id = $2 FOR UPDATE", [payload.siteId, user.organizationId]);
    if (!site.rowCount) throw new Error("VALIDATION:Site introuvable.");
    const equipment = await client.query<{ id: string }>("SELECT id FROM equipment WHERE site_id = $1 AND organization_id = $2 AND id = ANY($3::uuid[])", [payload.siteId, user.organizationId, payload.equipmentIds]);
    if (equipment.rowCount !== payload.equipmentIds.length) throw new Error("VALIDATION:Un équipement ne correspond pas au site sélectionné.");
    if (payload.technicianId) {
      const technician = await client.query("SELECT 1 FROM profiles WHERE id = $1 AND organization_id = $2 AND active = true AND role IN ('technician','subcontractor')", [payload.technicianId, user.organizationId]);
      if (!technician.rowCount) throw new Error("VALIDATION:Technicien introuvable ou inactif.");
      const overlap = await client.query(`
        SELECT public_code FROM jobs WHERE organization_id = $1 AND primary_technician_id = $2
          AND status NOT IN ('completed','cancelled','no_show','interrupted')
          AND scheduled_start < $4 AND scheduled_end > $3 LIMIT 1
      `, [user.organizationId, payload.technicianId, scheduledStart, scheduledEnd]);
      if (overlap.rowCount) throw new Error(`CONFLICT:Ce technicien est déjà occupé sur ${overlap.rows[0].public_code}.`);
    }
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`job-code:${user.organizationId}`]);
    const codeResult = await client.query<{ code: string }>(`
      SELECT concat('INT-', extract(year from $2::timestamptz)::int, '-', lpad((coalesce(max(right(public_code, 6)::int), 0) + 1)::text, 6, '0')) AS code
      FROM jobs WHERE organization_id = $1 AND public_code ~ '^INT-[0-9]{4}-[0-9]{6}$'
    `, [user.organizationId, scheduledStart]);
    const publicCode = codeResult.rows[0].code;
    const inserted = await client.query<{ id: string }>(`
      INSERT INTO jobs (organization_id, public_code, site_id, primary_technician_id, scheduled_start, scheduled_end, status, service_type, notes, price_cents, payment_status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, nullif(trim($9), ''), $10, 'pending') RETURNING id
    `, [user.organizationId, publicCode, payload.siteId, payload.technicianId, scheduledStart, scheduledEnd, payload.technicianId ? "assigned" : "scheduled", payload.serviceType, payload.notes, payload.priceCents]);
    for (const [index, equipmentId] of payload.equipmentIds.entries()) await client.query("INSERT INTO job_equipment (job_id, equipment_id, sequence, status) VALUES ($1, $2, $3, 'pending')", [inserted.rows[0].id, equipmentId, index + 1]);
    await client.query("INSERT INTO audit_logs (organization_id, actor_id, entity_type, entity_id, action, after_json) VALUES ($1, $2, 'job', $3, 'job.created', $4::jsonb)", [user.organizationId, user.id, inserted.rows[0].id, JSON.stringify({ publicCode, technicianId: payload.technicianId, equipmentCount: payload.equipmentIds.length })]);
    await client.query("INSERT INTO integration_events (organization_id, event_type, entity_id, payload) VALUES ($1, 'job.created', $2, $3::jsonb)", [user.organizationId, inserted.rows[0].id, JSON.stringify({ jobId: inserted.rows[0].id, publicCode, technicianId: payload.technicianId })]);
    await client.query("COMMIT");
    return Response.json({ id: publicCode }, { status: 201 });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    if (error instanceof Error && error.message.startsWith("VALIDATION:")) return Response.json({ error: error.message.slice(11) }, { status: 400 });
    if (error instanceof Error && error.message.startsWith("CONFLICT:")) return Response.json({ error: error.message.slice(9) }, { status: 409 });
    console.error("Création de l'intervention impossible.", error);
    return Response.json({ error: "L’intervention n'a pas pu être créée." }, { status: 500 });
  } finally { client.release(); }
}
