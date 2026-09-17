import { createHash, randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, relative } from "node:path";
import sharp from "sharp";
import { getCurrentUser } from "@/lib/auth/session";
import { database } from "@/lib/db";
import { photoStorageRoot, resolvePrivatePhoto } from "@/lib/photo-storage";

const allowedTypes = new Set(["before_overview", "before_environment", "model_label", "before_filters", "before_coil", "before_blower", "before_damage", "after_overview", "after_environment", "after_filters", "after_coil", "after_blower"]);
const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentification requise." }, { status: 401 });
  if (user.role !== "technician" && user.role !== "subcontractor") return Response.json({ error: "Acces refuse." }, { status: 403 });

  const form = await request.formData();
  const file = form.get("file");
  const equipmentId = form.get("equipmentId");
  const photoType = form.get("photoType");
  if (!(file instanceof File) || typeof equipmentId !== "string" || typeof photoType !== "string") return Response.json({ error: "Fichier ou emplacement manquant." }, { status: 400 });
  if (!allowedTypes.has(photoType)) return Response.json({ error: "Type de photo invalide." }, { status: 400 });
  if (!allowedMimeTypes.has(file.type)) return Response.json({ error: "Format accepte : JPEG, PNG ou WebP." }, { status: 415 });
  if (file.size < 1 || file.size > 10 * 1024 * 1024) return Response.json({ error: "La photo doit peser moins de 10 Mo." }, { status: 413 });

  const { id: publicCode } = await params;
  const client = await database.connect();
  let absolutePath: string | null = null;
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.organization_id', $1, true)", [user.organizationId]);
    const job = await client.query<{ id: string }>(`
      SELECT j.id FROM jobs j
      JOIN job_equipment je ON je.job_id = j.id
      WHERE j.public_code = $1 AND j.organization_id = $2
        AND j.primary_technician_id = $3 AND je.equipment_id = $4
      LIMIT 1 FOR UPDATE OF j
    `, [publicCode, user.organizationId, user.id, equipmentId]);
    if (!job.rowCount) {
      await client.query("ROLLBACK");
      return Response.json({ error: "Intervention ou equipement introuvable." }, { status: 404 });
    }
    if (photoType.startsWith("after_")) {
      const progress = await client.query<{ responses: string; items: number }>(`
        SELECT count(DISTINCT response.item_id)::text AS responses,
          coalesce(max(jsonb_array_length(snapshot.snapshot_json -> 'items')), 0) AS items
        FROM job_checklist_snapshots snapshot
        LEFT JOIN checklist_responses response ON response.job_id = snapshot.job_id AND response.equipment_id = $2
        WHERE snapshot.job_id = $1
      `, [job.rows[0].id, equipmentId]);
      if (!progress.rowCount || progress.rows[0].items === 0 || Number(progress.rows[0].responses) < progress.rows[0].items) {
        await client.query("ROLLBACK");
        return Response.json({ error: "La checklist de nettoyage doit être validée avant les photos après." }, { status: 409 });
      }
    }

    const input = Buffer.from(await file.arrayBuffer());
    const processed = await sharp(input, { limitInputPixels: 40_000_000 })
      .autoOrient()
      .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    const photoId = randomUUID();
    const root = photoStorageRoot();
    absolutePath = resolvePrivatePhoto(`${user.organizationId}/jobs/${job.rows[0].id}/equipment/${equipmentId}/${photoType}/${photoId}.jpg`);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, processed.data, { flag: "wx" });
    const storagePath = relative(root, absolutePath).replaceAll("\\", "/");
    const checksum = createHash("sha256").update(processed.data).digest("hex");

    await client.query(`UPDATE photos SET active = false WHERE job_id = $1 AND equipment_id = $2 AND photo_type = $3 AND active = true`, [job.rows[0].id, equipmentId, photoType]);
    const inserted = await client.query<{ id: string }>(`
      INSERT INTO photos (
        id, organization_id, job_id, equipment_id, photo_type, storage_path,
        source, captured_at, uploaded_by, checksum, mime_type, size_bytes, width_px, height_px
      ) VALUES ($1, $2, $3, $4, $5, $6, 'technician', now(), $7, $8, 'image/jpeg', $9, $10, $11)
      RETURNING id
    `, [photoId, user.organizationId, job.rows[0].id, equipmentId, photoType, storagePath, user.id, checksum, processed.info.size, processed.info.width, processed.info.height]);
    await client.query(`INSERT INTO audit_logs (organization_id, actor_id, entity_type, entity_id, action, after_json) VALUES ($1, $2, 'job', $3, 'photo.uploaded', $4::jsonb)`, [user.organizationId, user.id, job.rows[0].id, JSON.stringify({ photoId, equipmentId, photoType })]);
    await client.query(`INSERT INTO integration_events (organization_id, event_type, entity_id, payload) VALUES ($1, 'photo.uploaded', $2, $3::jsonb)`, [user.organizationId, inserted.rows[0].id, JSON.stringify({ photoId, jobId: job.rows[0].id, equipmentId, photoType })]);
    await client.query("COMMIT");
    return Response.json({ id: inserted.rows[0].id, url: `/api/photos/${inserted.rows[0].id}` });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    if (absolutePath) await rm(absolutePath, { force: true }).catch(() => undefined);
    console.error("Echec de l'upload photo.", error);
    return Response.json({ error: "La photo n'a pas pu etre enregistree." }, { status: 500 });
  } finally {
    client.release();
  }
}
