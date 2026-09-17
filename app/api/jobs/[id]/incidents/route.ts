import { createHash, randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, relative } from "node:path";
import sharp from "sharp";
import { getCurrentUser } from "@/lib/auth/session";
import { database } from "@/lib/db";
import { photoStorageRoot, resolvePrivatePhoto } from "@/lib/photo-storage";

const allowedTypes = new Set(["preexisting_damage", "preexisting_leak", "error_code", "abnormal_noise", "no_power_or_no_start", "access_impossible", "broken_clip", "accidental_water", "customer_property_damage", "drain_issue", "incomplete_access", "other"]);
const allowedMoments = new Set(["before", "during", "after"]);
const allowedSeverities = new Set(["information", "minor", "critical"]);
const allowedActions = new Set(["continue", "stopped", "manager_called"]);
const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentification requise." }, { status: 401 });
  if (user.role !== "technician" && user.role !== "subcontractor") return Response.json({ error: "Accès refusé." }, { status: 403 });
  const form = await request.formData();
  const file = form.get("file"); const equipmentId = form.get("equipmentId"); const incidentType = form.get("incidentType");
  const moment = form.get("moment"); const severity = form.get("severity"); const description = form.get("description"); const action = form.get("action");
  if (!(file instanceof File) || typeof equipmentId !== "string" || typeof incidentType !== "string" || typeof moment !== "string" || typeof severity !== "string" || typeof description !== "string" || typeof action !== "string") return Response.json({ error: "Tous les champs et la photo sont obligatoires." }, { status: 400 });
  if (!allowedTypes.has(incidentType) || !allowedMoments.has(moment) || !allowedSeverities.has(severity) || !allowedActions.has(action)) return Response.json({ error: "Valeur de signalement invalide." }, { status: 400 });
  if (description.trim().length < 5 || description.length > 1200) return Response.json({ error: "La description doit contenir entre 5 et 1 200 caractères." }, { status: 400 });
  if (!allowedMimeTypes.has(file.type)) return Response.json({ error: "Format accepté : JPEG, PNG ou WebP." }, { status: 415 });
  if (file.size < 1 || file.size > 10 * 1024 * 1024) return Response.json({ error: "La photo doit peser moins de 10 Mo." }, { status: 413 });
  const clientInformed = form.get("clientInformed") === "true";
  const { id: publicJobCode } = await params;
  const client = await database.connect(); let absolutePath: string | null = null;
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.organization_id', $1, true)", [user.organizationId]);
    const job = await client.query<{ id: string }>(`
      SELECT job.id FROM jobs job JOIN job_equipment assignment ON assignment.job_id = job.id
      WHERE job.public_code = $1 AND job.organization_id = $2 AND job.primary_technician_id = $3
        AND assignment.equipment_id = $4 LIMIT 1 FOR UPDATE OF job
    `, [publicJobCode, user.organizationId, user.id, equipmentId]);
    if (!job.rowCount) { await client.query("ROLLBACK"); return Response.json({ error: "Intervention ou équipement introuvable." }, { status: 404 }); }
    const incidentId = randomUUID(); const photoId = randomUUID();
    const input = Buffer.from(await file.arrayBuffer());
    const processed = await sharp(input, { limitInputPixels: 40_000_000 }).autoOrient().resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85, mozjpeg: true }).toBuffer({ resolveWithObject: true });
    const root = photoStorageRoot(); absolutePath = resolvePrivatePhoto(`${user.organizationId}/jobs/${job.rows[0].id}/equipment/${equipmentId}/incidents/${incidentId}/${photoId}.jpg`);
    await mkdir(dirname(absolutePath), { recursive: true }); await writeFile(absolutePath, processed.data, { flag: "wx" });
    const storagePath = relative(root, absolutePath).replaceAll("\\", "/"); const checksum = createHash("sha256").update(processed.data).digest("hex");
    const code = `INC-${new Date().getFullYear()}-${incidentId.replaceAll("-", "").slice(0, 6).toUpperCase()}`;
    await client.query(`
      INSERT INTO incidents (id, organization_id, public_code, job_id, equipment_id, incident_type, moment, severity, status, description, client_informed_at, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'open', $9, CASE WHEN $10 THEN now() ELSE NULL END, $11)
    `, [incidentId, user.organizationId, code, job.rows[0].id, equipmentId, incidentType, moment, severity, `${description.trim()} Action : ${action}.`, clientInformed, user.id]);
    await client.query(`
      INSERT INTO photos (id, organization_id, job_id, equipment_id, incident_id, photo_type, storage_path, source, captured_at, uploaded_by, checksum, mime_type, size_bytes, width_px, height_px)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'technician', now(), $8, $9, 'image/jpeg', $10, $11, $12)
    `, [photoId, user.organizationId, job.rows[0].id, equipmentId, incidentId, `incident_${incidentId}`, storagePath, user.id, checksum, processed.info.size, processed.info.width, processed.info.height]);
    if (severity === "critical" || action === "stopped") await client.query("UPDATE jobs SET status = 'blocked', updated_at = now() WHERE id = $1", [job.rows[0].id]);
    await client.query("INSERT INTO audit_logs (organization_id, actor_id, entity_type, entity_id, action, after_json) VALUES ($1, $2, 'incident', $3, 'incident.created', $4::jsonb)", [user.organizationId, user.id, incidentId, JSON.stringify({ jobId: job.rows[0].id, equipmentId, severity, action, photoId })]);
    await client.query("INSERT INTO integration_events (organization_id, event_type, entity_id, payload) VALUES ($1, 'incident.created', $2, $3::jsonb)", [user.organizationId, incidentId, JSON.stringify({ incidentId, publicCode: code, jobId: job.rows[0].id, technicianId: user.id, severity, action })]);
    await client.query("COMMIT");
    return Response.json({ id: incidentId, publicCode: code, photoId }, { status: 201 });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined); if (absolutePath) await rm(absolutePath, { force: true }).catch(() => undefined);
    console.error("Création de l'incident impossible.", error); return Response.json({ error: "L’incident n'a pas pu être déclaré." }, { status: 500 });
  } finally { client.release(); }
}
