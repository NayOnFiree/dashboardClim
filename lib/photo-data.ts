import "server-only";

import { database } from "@/lib/db";

export type BeforePhoto = { id: string; type: string };
export type AfterPhoto = BeforePhoto;

export async function getBeforePhotos(jobCode: string, equipmentId: string, technicianId: string, organizationId: string) {
  const client = await database.connect();
  try {
    await client.query("BEGIN READ ONLY");
    await client.query("SELECT set_config('app.organization_id', $1, true)", [organizationId]);
    const result = await client.query<BeforePhoto>(`
      SELECT ph.id, ph.photo_type AS type
      FROM photos ph
      JOIN jobs j ON j.id = ph.job_id
      WHERE j.public_code = $1
        AND j.organization_id = $2
        AND j.primary_technician_id = $3
        AND ph.equipment_id = $4
        AND ph.active = true
        AND (ph.photo_type LIKE 'before_%' OR (
          j.public_code = $1 AND j.organization_id = $2 AND j.primary_technician_id = $3
          AND ph.equipment_id = $4 AND ph.active = true AND ph.photo_type = 'model_label'
        ))
    `, [jobCode, organizationId, technicianId, equipmentId]);
    await client.query("ROLLBACK");
    return result.rows;
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    return [];
  } finally {
    client.release();
  }
}

export async function getAfterPhotos(jobCode: string, equipmentId: string, technicianId: string, organizationId: string) {
  const client = await database.connect();
  try {
    await client.query("BEGIN READ ONLY");
    await client.query("SELECT set_config('app.organization_id', $1, true)", [organizationId]);
    const result = await client.query<AfterPhoto>(`
      SELECT ph.id, ph.photo_type AS type
      FROM photos ph
      JOIN jobs j ON j.id = ph.job_id
      WHERE j.public_code = $1 AND j.organization_id = $2
        AND j.primary_technician_id = $3 AND ph.equipment_id = $4
        AND ph.active = true AND ph.photo_type LIKE 'after_%'
    `, [jobCode, organizationId, technicianId, equipmentId]);
    await client.query("ROLLBACK");
    return result.rows;
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    return [];
  } finally { client.release(); }
}
