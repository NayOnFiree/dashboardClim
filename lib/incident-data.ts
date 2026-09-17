import "server-only";

import { database } from "@/lib/db";

export type AdminIncident = {
  id: string; publicCode: string; jobCode: string; customer: string; city: string;
  equipment?: string; type: string; moment: string; severity: string; status: string;
  description: string; technician: string; clientInformed: boolean; closureOverride: boolean;
  createdAt: string; photoId?: string;
};

export async function getAdminIncidents(organizationId: string) {
  const client = await database.connect();
  try {
    await client.query("BEGIN READ ONLY");
    await client.query("SELECT set_config('app.organization_id', $1, true)", [organizationId]);
    const result = await client.query<{
      id: string; public_code: string; job_code: string; customer: string; city: string; equipment: string | null;
      incident_type: string; moment: string; severity: string; status: string; description: string;
      technician: string; client_informed: boolean; closure_override: boolean; created_at: string; photo_id: string | null;
    }>(`
      SELECT incident.id, incident.public_code, job.public_code AS job_code, customer.name AS customer, site.city,
        CASE WHEN equipment.id IS NULL THEN NULL ELSE concat(equipment.room, ' · ', coalesce(equipment.brand, ''), ' ', coalesce(equipment.model, '')) END AS equipment,
        incident.incident_type, incident.moment, incident.severity::text, incident.status::text, incident.description,
        concat_ws(' ', creator.first_name, creator.last_name) AS technician,
        incident.client_informed_at IS NOT NULL AS client_informed, incident.closure_override,
        to_char(incident.created_at AT TIME ZONE 'Europe/Paris', 'DD/MM/YYYY HH24:MI') AS created_at,
        max(photo.id::text) AS photo_id
      FROM incidents incident
      JOIN jobs job ON job.id = incident.job_id JOIN sites site ON site.id = job.site_id
      JOIN customers customer ON customer.id = site.customer_id JOIN profiles creator ON creator.id = incident.created_by
      LEFT JOIN equipment ON equipment.id = incident.equipment_id
      LEFT JOIN photos photo ON photo.incident_id = incident.id AND photo.active = true
      WHERE incident.organization_id = $1
      GROUP BY incident.id, job.id, customer.id, site.id, equipment.id, creator.id
      ORDER BY CASE incident.severity WHEN 'critical' THEN 1 WHEN 'minor' THEN 2 ELSE 3 END, incident.created_at DESC
    `, [organizationId]);
    await client.query("ROLLBACK");
    return result.rows.map((row) => ({
      id: row.id, publicCode: row.public_code, jobCode: row.job_code, customer: row.customer, city: row.city,
      equipment: row.equipment ?? undefined, type: row.incident_type, moment: row.moment, severity: row.severity,
      status: row.status, description: row.description, technician: row.technician,
      clientInformed: row.client_informed, closureOverride: row.closure_override, createdAt: row.created_at,
      photoId: row.photo_id ?? undefined,
    })) satisfies AdminIncident[];
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("Lecture des incidents impossible.", error);
    return [];
  } finally { client.release(); }
}

export async function getJobIncidents(jobCode: string, technicianId: string, organizationId: string) {
  const client = await database.connect();
  try {
    await client.query("BEGIN READ ONLY");
    await client.query("SELECT set_config('app.organization_id', $1, true)", [organizationId]);
    const result = await client.query<{ public_code: string; severity: string; status: string; description: string; created_at: string }>(`
      SELECT incident.public_code, incident.severity::text, incident.status::text, incident.description,
        to_char(incident.created_at AT TIME ZONE 'Europe/Paris', 'HH24:MI') AS created_at
      FROM incidents incident JOIN jobs job ON job.id = incident.job_id
      WHERE job.public_code = $1 AND job.organization_id = $2 AND job.primary_technician_id = $3
      ORDER BY incident.created_at DESC
    `, [jobCode, organizationId, technicianId]);
    await client.query("ROLLBACK");
    return result.rows.map((row) => ({ publicCode: row.public_code, severity: row.severity, status: row.status, description: row.description, createdAt: row.created_at }));
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    return [];
  } finally { client.release(); }
}
