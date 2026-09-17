import "server-only";

import { database } from "@/lib/db";

export type TechnicianHistoryItem = {
  id: string; date: string; time: string; customer: string; city: string; service: string; status: string;
  payment: string; equipmentCount: number; incidentCount: number; amountCents: number;
};
export type TechnicianSyncEvent = { id: string; type: string; status: string; attempts: number; createdAt: string; processedAt?: string; error?: string };
export type TechnicianSyncData = { pending: number; processed: number; failed: number; events: TechnicianSyncEvent[] };
export type TechnicianProfileData = {
  name: string; initials: string; email: string; phone?: string; workerType: string; company?: string;
  registrationNumber?: string; documentExpiry?: string; documentDaysLeft?: number; notes?: string;
  totalJobs: number; completedJobs: number; equipmentServiced: number; incidentCount: number;
};

async function clientForOrganization(organizationId: string) {
  const client = await database.connect();
  await client.query("BEGIN READ ONLY");
  await client.query("SELECT set_config('app.organization_id', $1, true)", [organizationId]);
  return client;
}

export async function getTechnicianHistory(userId: string, organizationId: string): Promise<TechnicianHistoryItem[]> {
  const client = await clientForOrganization(organizationId);
  try {
    const result = await client.query<{ public_code: string; date: string; time: string; customer: string; city: string; service_type: string; status: string; payment_status: string; equipment_count: string; incident_count: string; price_cents: number }>(`
      SELECT job.public_code,
        to_char(job.scheduled_start AT TIME ZONE 'Europe/Paris', 'DD/MM/YYYY') AS date,
        to_char(job.scheduled_start AT TIME ZONE 'Europe/Paris', 'HH24:MI') AS time,
        customer.name AS customer, site.city, job.service_type, job.status::text, job.payment_status::text,
        count(DISTINCT assignment.equipment_id)::text AS equipment_count,
        count(DISTINCT incident.id)::text AS incident_count, job.price_cents
      FROM jobs job JOIN sites site ON site.id = job.site_id JOIN customers customer ON customer.id = site.customer_id
      LEFT JOIN job_equipment assignment ON assignment.job_id = job.id
      LEFT JOIN incidents incident ON incident.job_id = job.id
      WHERE job.organization_id = $1 AND job.primary_technician_id = $2
      GROUP BY job.id, customer.id, site.id ORDER BY job.scheduled_start DESC NULLS LAST LIMIT 100
    `, [organizationId, userId]);
    await client.query("ROLLBACK");
    return result.rows.map((row) => ({ id: row.public_code, date: row.date, time: row.time, customer: row.customer, city: row.city, service: row.service_type === "deep_clean" ? "Nettoyage approfondi" : "Nettoyage standard", status: row.status, payment: row.payment_status, equipmentCount: Number(row.equipment_count), incidentCount: Number(row.incident_count), amountCents: row.price_cents }));
  } catch (error) { await client.query("ROLLBACK").catch(() => undefined); console.error("Lecture de l'historique technicien impossible.", error); return []; }
  finally { client.release(); }
}

export async function getTechnicianSyncData(userId: string, organizationId: string): Promise<TechnicianSyncData> {
  const client = await clientForOrganization(organizationId);
  try {
    const result = await client.query<{ id: string; event_type: string; status: string; attempts: number; created_at: string; processed_at: string | null; last_error: string | null }>(`
      SELECT event.id, event.event_type, event.status, event.attempts,
        to_char(event.created_at AT TIME ZONE 'Europe/Paris', 'DD/MM/YYYY HH24:MI') AS created_at,
        to_char(event.processed_at AT TIME ZONE 'Europe/Paris', 'DD/MM/YYYY HH24:MI') AS processed_at, event.last_error
      FROM integration_events event
      WHERE event.organization_id = $1 AND (
        event.payload ->> 'technicianId' = $2::text OR EXISTS (
          SELECT 1 FROM jobs job WHERE job.organization_id = $1 AND job.primary_technician_id = $2
          AND (job.id = event.entity_id OR job.id::text = event.payload ->> 'jobId')
        )
      ) ORDER BY event.created_at DESC LIMIT 50
    `, [organizationId, userId]);
    await client.query("ROLLBACK");
    const events = result.rows.map((row) => ({ id: row.id, type: row.event_type, status: row.status, attempts: row.attempts, createdAt: row.created_at, processedAt: row.processed_at ?? undefined, error: row.last_error ?? undefined }));
    return { pending: events.filter((event) => ["pending", "processing"].includes(event.status)).length, processed: events.filter((event) => event.status === "processed").length, failed: events.filter((event) => event.status === "dead").length, events };
  } catch (error) { await client.query("ROLLBACK").catch(() => undefined); console.error("Lecture de la synchronisation technicien impossible.", error); return { pending: 0, processed: 0, failed: 0, events: [] }; }
  finally { client.release(); }
}

export async function getTechnicianProfile(userId: string, organizationId: string): Promise<TechnicianProfileData | undefined> {
  const client = await clientForOrganization(organizationId);
  try {
    const result = await client.query<{ first_name: string; last_name: string; email: string; phone: string | null; worker_type: string | null; company_name: string | null; registration_number: string | null; document_expiry: string | null; document_days_left: number | null; notes: string | null; total_jobs: string; completed_jobs: string; equipment_serviced: string; incident_count: string }>(`
      SELECT profile.first_name, profile.last_name, profile.email, profile.phone, technician.worker_type,
        technician.company_name, technician.registration_number,
        to_char(technician.document_expiry_at, 'DD/MM/YYYY') AS document_expiry,
        (technician.document_expiry_at - current_date)::int AS document_days_left, technician.notes,
        count(DISTINCT job.id)::text AS total_jobs,
        count(DISTINCT job.id) FILTER (WHERE job.status IN ('completed','completed_pending_payment'))::text AS completed_jobs,
        count(DISTINCT assignment.equipment_id) FILTER (WHERE assignment.status = 'completed')::text AS equipment_serviced,
        count(DISTINCT incident.id)::text AS incident_count
      FROM profiles profile LEFT JOIN technician_profiles technician ON technician.user_id = profile.id
      LEFT JOIN jobs job ON job.primary_technician_id = profile.id
      LEFT JOIN job_equipment assignment ON assignment.job_id = job.id
      LEFT JOIN incidents incident ON incident.job_id = job.id AND incident.created_by = profile.id
      WHERE profile.id = $1 AND profile.organization_id = $2 GROUP BY profile.id, technician.user_id
    `, [userId, organizationId]);
    await client.query("ROLLBACK");
    const row = result.rows[0]; if (!row) return undefined;
    const name = `${row.first_name} ${row.last_name}`;
    return { name, initials: `${row.first_name[0]}${row.last_name[0]}`.toUpperCase(), email: row.email, phone: row.phone ?? undefined, workerType: row.worker_type ?? "internal", company: row.company_name ?? undefined, registrationNumber: row.registration_number ?? undefined, documentExpiry: row.document_expiry ?? undefined, documentDaysLeft: row.document_days_left ?? undefined, notes: row.notes ?? undefined, totalJobs: Number(row.total_jobs), completedJobs: Number(row.completed_jobs), equipmentServiced: Number(row.equipment_serviced), incidentCount: Number(row.incident_count) };
  } catch (error) { await client.query("ROLLBACK").catch(() => undefined); console.error("Lecture du profil technicien impossible.", error); return undefined; }
  finally { client.release(); }
}
