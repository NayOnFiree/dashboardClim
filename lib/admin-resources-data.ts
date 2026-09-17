import "server-only";

import type { PoolClient } from "pg";
import { database } from "@/lib/db";

export type AdminTechnician = {
  id: string; name: string; email: string; phone?: string; role: string; workerType: string;
  company?: string; documentExpiry?: string; documentDaysLeft?: number; notes?: string;
  totalJobs: number; completedJobs: number; upcomingJobs: number; openIncidents: number;
};

export type QualityJob = {
  id: string; customer: string; technician: string; date?: string; status: string;
  equipmentCount: number; beforePhotos: number; afterPhotos: number; checklistResponses: number;
  checklistExpected: number; finalChecks: number; passedChecks: number; incidentCount: number; score: number;
};

export type AdminProduct = {
  id: string; name: string; manufacturer?: string; instructions: string; contactTime?: number;
  rinseRule: string; safetyNotes?: string; active: boolean; usageCount: number; quantityMl: number;
};

export type AdminProtocol = {
  id: string; name: string; version: number; serviceType: string; active: boolean;
  itemCount: number; criticalCount: number; items: Array<{ label: string; required: boolean; critical: boolean }>;
};

async function withOrganization<T>(organizationId: string, work: (client: PoolClient) => Promise<T>, fallback: T): Promise<T> {
  const client = await database.connect();
  try {
    await client.query("BEGIN READ ONLY");
    await client.query("SELECT set_config('app.organization_id', $1, true)", [organizationId]);
    const result = await work(client);
    await client.query("ROLLBACK");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("Lecture d'un module administratif impossible.", error);
    return fallback;
  } finally { client.release(); }
}

export async function getAdminTechnicians(organizationId: string): Promise<AdminTechnician[]> {
  return withOrganization(organizationId, async (client) => {
    const result = await client.query<{
      id: string; name: string; email: string; phone: string | null; role: string; worker_type: string | null;
      company_name: string | null; document_expiry: string | null; document_days_left: number | null; notes: string | null;
      total_jobs: string; completed_jobs: string; upcoming_jobs: string; open_incidents: string;
    }>(`
      SELECT profile.id, concat_ws(' ', profile.first_name, profile.last_name) AS name,
        profile.email, profile.phone, profile.role::text, technician.worker_type, technician.company_name,
        to_char(technician.document_expiry_at, 'DD/MM/YYYY') AS document_expiry,
        (technician.document_expiry_at - current_date)::int AS document_days_left, technician.notes,
        count(DISTINCT job.id)::text AS total_jobs,
        count(DISTINCT job.id) FILTER (WHERE job.status IN ('completed','completed_pending_payment'))::text AS completed_jobs,
        count(DISTINCT job.id) FILTER (WHERE job.scheduled_start >= now() AND job.status IN ('scheduled','assigned'))::text AS upcoming_jobs,
        count(DISTINCT incident.id) FILTER (WHERE incident.status NOT IN ('resolved','closed_no_action'))::text AS open_incidents
      FROM profiles profile
      LEFT JOIN technician_profiles technician ON technician.user_id = profile.id
      LEFT JOIN jobs job ON job.primary_technician_id = profile.id
      LEFT JOIN incidents incident ON incident.job_id = job.id
      WHERE profile.organization_id = $1 AND profile.active = true AND profile.role IN ('technician','subcontractor')
      GROUP BY profile.id, technician.user_id
      ORDER BY profile.first_name, profile.last_name
    `, [organizationId]);
    return result.rows.map((row) => ({ id: row.id, name: row.name, email: row.email, phone: row.phone ?? undefined, role: row.role, workerType: row.worker_type ?? "internal", company: row.company_name ?? undefined, documentExpiry: row.document_expiry ?? undefined, documentDaysLeft: row.document_days_left ?? undefined, notes: row.notes ?? undefined, totalJobs: Number(row.total_jobs), completedJobs: Number(row.completed_jobs), upcomingJobs: Number(row.upcoming_jobs), openIncidents: Number(row.open_incidents) }));
  }, []);
}

export async function getQualityJobs(organizationId: string): Promise<QualityJob[]> {
  return withOrganization(organizationId, async (client) => {
    const result = await client.query<{
      public_code: string; customer: string; technician: string | null; date: string | null; status: string;
      equipment_count: string; before_photos: string; after_photos: string; checklist_responses: string;
      checklist_expected: string; final_checks: string; passed_checks: string; incident_count: string;
    }>(`
      SELECT job.public_code, customer.name AS customer,
        nullif(concat_ws(' ', profile.first_name, profile.last_name), '') AS technician,
        to_char(job.scheduled_start AT TIME ZONE 'Europe/Paris', 'DD/MM/YYYY') AS date, job.status::text,
        (SELECT count(*) FROM job_equipment assignment WHERE assignment.job_id = job.id)::text AS equipment_count,
        (SELECT count(*) FROM photos photo WHERE photo.job_id = job.id AND photo.active = true AND (photo.photo_type LIKE 'before_%' OR photo.photo_type = 'model_label'))::text AS before_photos,
        (SELECT count(*) FROM photos photo WHERE photo.job_id = job.id AND photo.active = true AND photo.photo_type LIKE 'after_%')::text AS after_photos,
        (SELECT count(*) FROM checklist_responses response WHERE response.job_id = job.id)::text AS checklist_responses,
        ((SELECT coalesce(jsonb_array_length(snapshot.snapshot_json -> 'items'), 0) FROM job_checklist_snapshots snapshot WHERE snapshot.job_id = job.id) * (SELECT count(*) FROM job_equipment assignment WHERE assignment.job_id = job.id))::text AS checklist_expected,
        (SELECT count(*) FROM job_final_checks final WHERE final.job_id = job.id)::text AS final_checks,
        (SELECT count(*) FROM job_final_checks final WHERE final.job_id = job.id AND final.passed = true)::text AS passed_checks,
        (SELECT count(*) FROM incidents incident WHERE incident.job_id = job.id AND incident.status NOT IN ('resolved','closed_no_action'))::text AS incident_count
      FROM jobs job
      JOIN sites site ON site.id = job.site_id
      JOIN customers customer ON customer.id = site.customer_id
      LEFT JOIN profiles profile ON profile.id = job.primary_technician_id
      WHERE job.organization_id = $1 AND job.status NOT IN ('draft','cancelled')
      ORDER BY job.scheduled_start DESC NULLS LAST
      LIMIT 100
    `, [organizationId]);
    return result.rows.map((row) => {
      const equipmentCount = Number(row.equipment_count); const beforePhotos = Number(row.before_photos); const afterPhotos = Number(row.after_photos); const checklistResponses = Number(row.checklist_responses); const checklistExpected = Number(row.checklist_expected); const finalChecks = Number(row.final_checks); const passedChecks = Number(row.passed_checks);
      const photoScore = equipmentCount ? Math.min(1, (beforePhotos + afterPhotos) / (equipmentCount * 7)) : 0;
      const checklistScore = checklistExpected ? Math.min(1, checklistResponses / checklistExpected) : 0;
      const finalScore = equipmentCount ? Math.min(1, passedChecks / equipmentCount) : 0;
      return { id: row.public_code, customer: row.customer, technician: row.technician ?? "Non attribuée", date: row.date ?? undefined, status: row.status, equipmentCount, beforePhotos, afterPhotos, checklistResponses, checklistExpected, finalChecks, passedChecks, incidentCount: Number(row.incident_count), score: Math.round((photoScore * .35 + checklistScore * .35 + finalScore * .3) * 100) };
    });
  }, []);
}

export async function getProductsAndProtocols(organizationId: string): Promise<{ products: AdminProduct[]; protocols: AdminProtocol[] }> {
  return withOrganization(organizationId, async (client) => {
    const [products, protocols] = await Promise.all([
      client.query<{ id: string; name: string; manufacturer: string | null; instructions: string; contact_time_minutes: number | null; rinse_rule: string; safety_notes: string | null; active: boolean; usage_count: string; quantity_ml: string }>(`
        SELECT product.id, product.name, product.manufacturer, product.instructions, product.contact_time_minutes,
          product.rinse_rule, product.safety_notes, product.active, count(usage.id)::text AS usage_count,
          coalesce(sum(usage.quantity_ml), 0)::text AS quantity_ml
        FROM products product LEFT JOIN product_usage usage ON usage.product_id = product.id
        WHERE product.organization_id = $1 GROUP BY product.id ORDER BY product.active DESC, product.name
      `, [organizationId]),
      client.query<{ id: string; name: string; version: number; service_type: string; active: boolean; item_count: string; critical_count: string; items: Array<{ label: string; required: boolean; critical: boolean }> }>(`
        SELECT template.id, template.name, template.version, template.service_type, template.active,
          count(item.id)::text AS item_count,
          count(item.id) FILTER (WHERE item.critical_required)::text AS critical_count,
          coalesce(jsonb_agg(jsonb_build_object('label', item.label, 'required', item.required, 'critical', item.critical_required) ORDER BY item.order_index) FILTER (WHERE item.id IS NOT NULL), '[]'::jsonb) AS items
        FROM checklist_templates template LEFT JOIN checklist_items item ON item.template_id = template.id
        WHERE template.organization_id = $1 GROUP BY template.id ORDER BY template.active DESC, template.name, template.version DESC
      `, [organizationId]),
    ]);
    return {
      products: products.rows.map((row) => ({ id: row.id, name: row.name, manufacturer: row.manufacturer ?? undefined, instructions: row.instructions, contactTime: row.contact_time_minutes ?? undefined, rinseRule: row.rinse_rule, safetyNotes: row.safety_notes ?? undefined, active: row.active, usageCount: Number(row.usage_count), quantityMl: Number(row.quantity_ml) })),
      protocols: protocols.rows.map((row) => ({ id: row.id, name: row.name, version: row.version, serviceType: row.service_type, active: row.active, itemCount: Number(row.item_count), criticalCount: Number(row.critical_count), items: row.items })),
    };
  }, { products: [], protocols: [] });
}
