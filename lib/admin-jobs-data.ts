import "server-only";

import { database } from "@/lib/db";

export type AdminJobListItem = {
  id: string; customer: string; city: string; address: string; technician: string;
  technicianId?: string; equipmentCount: number; status: string; payment: string;
  service: string; priceCents: number; scheduledDate: string; startTime: string; endTime: string;
  incidentCount: number;
};

export type AdminTechnicianOption = { id: string; name: string; role: string };
export type AdminSiteOption = {
  id: string; label: string; customer: string; address: string;
  equipment: Array<{ id: string; label: string }>;
};

export type AdminJobDetail = {
  id: string; internalId: string; customer: string; phone?: string; email?: string; address: string;
  accessNotes?: string; technician: string; technicianId?: string; status: string; payment: string;
  service: string; priceCents: number; scheduledDate: string; startTime: string; endTime: string;
  startedAt?: string; completedAt?: string;
  equipment: Array<{ id: string; publicCode: string; room: string; brand: string; model: string; status: string; beforePhotos: number; afterPhotos: number; checklistResponses: number; finalPassed?: boolean; product?: string }>;
  incidents: Array<{ id: string; publicCode: string; severity: string; status: string; description: string; createdAt: string }>;
  timeline: Array<{ action: string; actor: string; createdAt: string }>;
};

const statusLabels: Record<string, string> = {
  draft: "Brouillon", needs_qualification: "À qualifier", scheduled: "Planifiée", assigned: "Planifiée",
  en_route: "En route", arrived: "Arrivée", in_progress: "En cours", blocked: "Bloquée",
  completed_pending_payment: "Terminée · paiement", completed: "Terminée", cancelled: "Annulée",
  no_show: "Absent", interrupted: "Interrompue",
};
const paymentLabels: Record<string, string> = {
  paid_cash: "Payé", paid_card: "Payé", paid_transfer: "Payé", pending: "En attente",
  payment_link_sent: "Lien envoyé", not_required: "À facturer", failed: "Échec", refunded: "Remboursé",
};
const serviceLabels: Record<string, string> = { maintenance: "Nettoyage standard", deep_clean: "Nettoyage approfondi" };

export async function getAdminJobsData(organizationId: string) {
  const client = await database.connect();
  try {
    await client.query("BEGIN READ ONLY");
    await client.query("SELECT set_config('app.organization_id', $1, true)", [organizationId]);
    const jobs = await client.query<{
      public_code: string; customer_name: string; city: string; address: string; technician_name: string | null;
      technician_id: string | null; equipment_count: string; status: string; payment_status: string;
      service_type: string; price_cents: number; scheduled_date: string; start_time: string; end_time: string; incident_count: string;
    }>(`
      SELECT job.public_code, customer.name AS customer_name, site.city,
        concat_ws(', ', site.address_line1, concat(site.postal_code, ' ', site.city)) AS address,
        nullif(concat_ws(' ', technician.first_name, technician.last_name), '') AS technician_name,
        technician.id AS technician_id, count(DISTINCT assignment.equipment_id)::text AS equipment_count,
        job.status::text, job.payment_status::text, job.service_type, job.price_cents,
        to_char(job.scheduled_start AT TIME ZONE 'Europe/Paris', 'YYYY-MM-DD') AS scheduled_date,
        to_char(job.scheduled_start AT TIME ZONE 'Europe/Paris', 'HH24:MI') AS start_time,
        to_char(job.scheduled_end AT TIME ZONE 'Europe/Paris', 'HH24:MI') AS end_time,
        count(DISTINCT incident.id) FILTER (WHERE incident.status NOT IN ('resolved','closed_no_action'))::text AS incident_count
      FROM jobs job
      JOIN sites site ON site.id = job.site_id
      JOIN customers customer ON customer.id = site.customer_id
      LEFT JOIN profiles technician ON technician.id = job.primary_technician_id
      LEFT JOIN job_equipment assignment ON assignment.job_id = job.id
      LEFT JOIN incidents incident ON incident.job_id = job.id
      WHERE job.organization_id = $1
      GROUP BY job.id, customer.id, site.id, technician.id
      ORDER BY job.scheduled_start DESC NULLS LAST, job.created_at DESC
      LIMIT 200
    `, [organizationId]);
    const technicians = await client.query<{ id: string; name: string; role: string }>(`
      SELECT id, concat_ws(' ', first_name, last_name) AS name, role::text
      FROM profiles WHERE organization_id = $1 AND active = true AND role IN ('technician','subcontractor')
      ORDER BY first_name, last_name
    `, [organizationId]);
    const sites = await client.query<{ id: string; label: string; customer: string; address: string; equipment: Array<{ id: string; label: string }> }>(`
      SELECT site.id, site.label, customer.name AS customer,
        concat_ws(', ', site.address_line1, concat(site.postal_code, ' ', site.city)) AS address,
        coalesce(jsonb_agg(jsonb_build_object('id', equipment.id, 'label', concat(equipment.room, ' · ', coalesce(equipment.brand, 'Marque à confirmer'), ' ', coalesce(equipment.model, '')))
          ORDER BY equipment.room) FILTER (WHERE equipment.id IS NOT NULL), '[]'::jsonb) AS equipment
      FROM sites site JOIN customers customer ON customer.id = site.customer_id
      LEFT JOIN equipment ON equipment.site_id = site.id
      WHERE site.organization_id = $1
      GROUP BY site.id, customer.id ORDER BY customer.name, site.label
    `, [organizationId]);
    await client.query("ROLLBACK");
    return {
      jobs: jobs.rows.map((job) => ({
        id: job.public_code, customer: job.customer_name, city: job.city, address: job.address,
        technician: job.technician_name ?? "Non attribuée", technicianId: job.technician_id ?? undefined,
        equipmentCount: Number(job.equipment_count), status: statusLabels[job.status] ?? job.status,
        payment: paymentLabels[job.payment_status] ?? job.payment_status,
        service: serviceLabels[job.service_type] ?? job.service_type, priceCents: job.price_cents,
        scheduledDate: job.scheduled_date ?? "Non planifiée", startTime: job.start_time ?? "--:--",
        endTime: job.end_time ?? "--:--", incidentCount: Number(job.incident_count),
      })) satisfies AdminJobListItem[],
      technicians: technicians.rows satisfies AdminTechnicianOption[],
      sites: sites.rows satisfies AdminSiteOption[],
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("Lecture des interventions administratives impossible.", error);
    return { jobs: [], technicians: [], sites: [] };
  } finally { client.release(); }
}

export async function getAdminJobDetail(publicCode: string, organizationId: string): Promise<AdminJobDetail | undefined> {
  const client = await database.connect();
  try {
    await client.query("BEGIN READ ONLY");
    await client.query("SELECT set_config('app.organization_id', $1, true)", [organizationId]);
    const jobResult = await client.query<{
      id: string; public_code: string; customer: string; phone: string | null; email: string | null; address: string;
      access_notes: string | null; technician: string | null; technician_id: string | null; status: string; payment_status: string;
      service_type: string; price_cents: number; scheduled_date: string; start_time: string; end_time: string;
      started_at: string | null; completed_at: string | null;
    }>(`
      SELECT job.id, job.public_code, customer.name AS customer, customer.phone, customer.email,
        concat_ws(', ', site.address_line1, concat(site.postal_code, ' ', site.city)) AS address,
        coalesce(job.notes, site.access_notes) AS access_notes,
        nullif(concat_ws(' ', technician.first_name, technician.last_name), '') AS technician,
        technician.id AS technician_id, job.status::text, job.payment_status::text, job.service_type, job.price_cents,
        to_char(job.scheduled_start AT TIME ZONE 'Europe/Paris', 'DD/MM/YYYY') AS scheduled_date,
        to_char(job.scheduled_start AT TIME ZONE 'Europe/Paris', 'HH24:MI') AS start_time,
        to_char(job.scheduled_end AT TIME ZONE 'Europe/Paris', 'HH24:MI') AS end_time,
        to_char(job.started_at AT TIME ZONE 'Europe/Paris', 'DD/MM/YYYY HH24:MI') AS started_at,
        to_char(job.completed_at AT TIME ZONE 'Europe/Paris', 'DD/MM/YYYY HH24:MI') AS completed_at
      FROM jobs job JOIN sites site ON site.id = job.site_id JOIN customers customer ON customer.id = site.customer_id
      LEFT JOIN profiles technician ON technician.id = job.primary_technician_id
      WHERE job.public_code = $1 AND job.organization_id = $2 LIMIT 1
    `, [publicCode, organizationId]);
    if (!jobResult.rowCount) { await client.query("ROLLBACK"); return undefined; }
    const job = jobResult.rows[0];
    const equipment = await client.query<{
      id: string; public_code: string; room: string; brand: string | null; model: string | null; status: string;
      before_photos: string; after_photos: string; checklist_responses: string; final_passed: boolean | null; product: string | null;
    }>(`
      SELECT equipment.id, equipment.public_code, equipment.room, equipment.brand, equipment.model, assignment.status,
        count(DISTINCT photo.id) FILTER (WHERE photo.active = true AND (photo.photo_type LIKE 'before_%' OR photo.photo_type = 'model_label'))::text AS before_photos,
        count(DISTINCT photo.id) FILTER (WHERE photo.active = true AND photo.photo_type LIKE 'after_%')::text AS after_photos,
        count(DISTINCT response.item_id)::text AS checklist_responses,
        bool_and(final.passed) FILTER (WHERE final.id IS NOT NULL) AS final_passed,
        max(product.name) AS product
      FROM job_equipment assignment JOIN equipment ON equipment.id = assignment.equipment_id
      LEFT JOIN photos photo ON photo.job_id = assignment.job_id AND photo.equipment_id = equipment.id
      LEFT JOIN checklist_responses response ON response.job_id = assignment.job_id AND response.equipment_id = equipment.id
      LEFT JOIN job_final_checks final ON final.job_id = assignment.job_id AND final.equipment_id = equipment.id
      LEFT JOIN product_usage usage ON usage.job_id = assignment.job_id AND usage.equipment_id = equipment.id
      LEFT JOIN products product ON product.id = usage.product_id
      WHERE assignment.job_id = $1 GROUP BY assignment.sequence, assignment.status, equipment.id ORDER BY assignment.sequence
    `, [job.id]);
    const incidents = await client.query<{ id: string; public_code: string; severity: string; status: string; description: string; created_at: string }>(`
      SELECT id, public_code, severity::text, status::text, description,
        to_char(created_at AT TIME ZONE 'Europe/Paris', 'DD/MM/YYYY HH24:MI') AS created_at
      FROM incidents WHERE job_id = $1 ORDER BY created_at DESC
    `, [job.id]);
    const timeline = await client.query<{ action: string; actor: string | null; created_at: string }>(`
      SELECT audit.action, nullif(concat_ws(' ', actor.first_name, actor.last_name), '') AS actor,
        to_char(audit.created_at AT TIME ZONE 'Europe/Paris', 'DD/MM/YYYY HH24:MI') AS created_at
      FROM audit_logs audit LEFT JOIN profiles actor ON actor.id = audit.actor_id
      WHERE audit.entity_type = 'job' AND audit.entity_id = $1 ORDER BY audit.created_at DESC LIMIT 50
    `, [job.id]);
    await client.query("ROLLBACK");
    return {
      id: job.public_code, internalId: job.id, customer: job.customer, phone: job.phone ?? undefined,
      email: job.email ?? undefined, address: job.address, accessNotes: job.access_notes ?? undefined,
      technician: job.technician ?? "Non attribuée", technicianId: job.technician_id ?? undefined,
      status: statusLabels[job.status] ?? job.status, payment: paymentLabels[job.payment_status] ?? job.payment_status,
      service: serviceLabels[job.service_type] ?? job.service_type, priceCents: job.price_cents,
      scheduledDate: job.scheduled_date, startTime: job.start_time, endTime: job.end_time,
      startedAt: job.started_at ?? undefined, completedAt: job.completed_at ?? undefined,
      equipment: equipment.rows.map((entry) => ({ id: entry.id, publicCode: entry.public_code, room: entry.room, brand: entry.brand ?? "À confirmer", model: entry.model ?? "", status: entry.status, beforePhotos: Number(entry.before_photos), afterPhotos: Number(entry.after_photos), checklistResponses: Number(entry.checklist_responses), finalPassed: entry.final_passed ?? undefined, product: entry.product ?? undefined })),
      incidents: incidents.rows.map((entry) => ({ id: entry.id, publicCode: entry.public_code, severity: entry.severity, status: entry.status, description: entry.description, createdAt: entry.created_at })),
      timeline: timeline.rows.map((entry) => ({ action: entry.action, actor: entry.actor ?? "Système", createdAt: entry.created_at })),
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("Lecture du détail intervention impossible.", error);
    return undefined;
  } finally { client.release(); }
}
