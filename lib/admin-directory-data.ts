import "server-only";

import { database } from "@/lib/db";

export type DirectoryCustomer = {
  id: string; name: string; type: string; phone?: string; email?: string; leadSource?: string;
  twentyId?: string; marketingConsent: boolean; siteCount: number; equipmentCount: number;
  jobCount: number; lastIntervention?: string;
};

export type DirectorySite = {
  id: string; label: string; customer: string; address: string; city: string; type: string;
  accessNotes?: string; contactName?: string; contactPhone?: string; equipmentCount: number;
  jobCount: number; lastIntervention?: string;
};

export type DirectoryEquipment = {
  id: string; publicCode: string; customer: string; site: string; address: string; city: string;
  type: string; brand?: string; model?: string; serialNumber?: string; room: string; difficulty: string;
  internalNotes?: string; jobCount: number; lastService?: string; lastTechnician?: string;
};

export type AdminDirectoryData = {
  customers: DirectoryCustomer[];
  sites: DirectorySite[];
  equipment: DirectoryEquipment[];
};

export async function getAdminDirectoryData(organizationId: string): Promise<AdminDirectoryData> {
  const client = await database.connect();
  try {
    await client.query("BEGIN READ ONLY");
    await client.query("SELECT set_config('app.organization_id', $1, true)", [organizationId]);

    const customers = await client.query<{
      id: string; name: string; customer_type: string; phone: string | null; email: string | null;
      lead_source: string | null; twenty_id: string | null; marketing_consent: boolean;
      site_count: string; equipment_count: string; job_count: string; last_intervention: string | null;
    }>(`
      SELECT customer.id, customer.name, customer.customer_type::text, customer.phone, customer.email,
        customer.lead_source, customer.twenty_id, customer.marketing_consent,
        count(DISTINCT site.id)::text AS site_count,
        count(DISTINCT equipment.id)::text AS equipment_count,
        count(DISTINCT job.id)::text AS job_count,
        to_char(max(coalesce(job.completed_at, job.scheduled_start)) AT TIME ZONE 'Europe/Paris', 'DD/MM/YYYY') AS last_intervention
      FROM customers customer
      LEFT JOIN sites site ON site.customer_id = customer.id
      LEFT JOIN equipment ON equipment.site_id = site.id
      LEFT JOIN jobs job ON job.site_id = site.id AND job.status <> 'cancelled'
      WHERE customer.organization_id = $1
      GROUP BY customer.id
      ORDER BY customer.name
    `, [organizationId]);

    const sites = await client.query<{
      id: string; label: string; customer: string; address: string; city: string; site_type: string;
      access_notes: string | null; contact_name: string | null; contact_phone: string | null;
      equipment_count: string; job_count: string; last_intervention: string | null;
    }>(`
      SELECT site.id, site.label, customer.name AS customer,
        concat_ws(', ', site.address_line1, nullif(site.address_line2, ''), concat(site.postal_code, ' ', site.city)) AS address,
        site.city, site.site_type::text, site.access_notes, site.contact_name, site.contact_phone,
        count(DISTINCT equipment.id)::text AS equipment_count,
        count(DISTINCT job.id)::text AS job_count,
        to_char(max(coalesce(job.completed_at, job.scheduled_start)) AT TIME ZONE 'Europe/Paris', 'DD/MM/YYYY') AS last_intervention
      FROM sites site
      JOIN customers customer ON customer.id = site.customer_id
      LEFT JOIN equipment ON equipment.site_id = site.id
      LEFT JOIN jobs job ON job.site_id = site.id AND job.status <> 'cancelled'
      WHERE site.organization_id = $1
      GROUP BY site.id, customer.id
      ORDER BY customer.name, site.label
    `, [organizationId]);

    const equipment = await client.query<{
      id: string; public_code: string; customer: string; site: string; address: string; city: string;
      equipment_type: string; brand: string | null; model: string | null; serial_number: string | null;
      room: string; difficulty: string; internal_notes: string | null; job_count: string;
      last_service: string | null; last_technician: string | null;
    }>(`
      SELECT equipment.id, equipment.public_code, customer.name AS customer, site.label AS site,
        concat_ws(', ', site.address_line1, concat(site.postal_code, ' ', site.city)) AS address,
        site.city, equipment.equipment_type::text, equipment.brand, equipment.model, equipment.serial_number,
        equipment.room, equipment.difficulty::text, equipment.internal_notes,
        count(DISTINCT assignment.job_id)::text AS job_count,
        latest.last_service, latest.last_technician
      FROM equipment
      JOIN sites site ON site.id = equipment.site_id
      JOIN customers customer ON customer.id = site.customer_id
      LEFT JOIN job_equipment assignment ON assignment.equipment_id = equipment.id
      LEFT JOIN LATERAL (
        SELECT to_char(coalesce(job.completed_at, job.scheduled_start) AT TIME ZONE 'Europe/Paris', 'DD/MM/YYYY') AS last_service,
          nullif(concat_ws(' ', profile.first_name, profile.last_name), '') AS last_technician
        FROM job_equipment history
        JOIN jobs job ON job.id = history.job_id
        LEFT JOIN profiles profile ON profile.id = job.primary_technician_id
        WHERE history.equipment_id = equipment.id AND job.status <> 'cancelled'
        ORDER BY coalesce(job.completed_at, job.scheduled_start) DESC NULLS LAST
        LIMIT 1
      ) latest ON true
      WHERE equipment.organization_id = $1
      GROUP BY equipment.id, site.id, customer.id, latest.last_service, latest.last_technician
      ORDER BY customer.name, site.label, equipment.room
    `, [organizationId]);

    await client.query("ROLLBACK");
    return {
      customers: customers.rows.map((row) => ({ id: row.id, name: row.name, type: row.customer_type, phone: row.phone ?? undefined, email: row.email ?? undefined, leadSource: row.lead_source ?? undefined, twentyId: row.twenty_id ?? undefined, marketingConsent: row.marketing_consent, siteCount: Number(row.site_count), equipmentCount: Number(row.equipment_count), jobCount: Number(row.job_count), lastIntervention: row.last_intervention ?? undefined })),
      sites: sites.rows.map((row) => ({ id: row.id, label: row.label, customer: row.customer, address: row.address, city: row.city, type: row.site_type, accessNotes: row.access_notes ?? undefined, contactName: row.contact_name ?? undefined, contactPhone: row.contact_phone ?? undefined, equipmentCount: Number(row.equipment_count), jobCount: Number(row.job_count), lastIntervention: row.last_intervention ?? undefined })),
      equipment: equipment.rows.map((row) => ({ id: row.id, publicCode: row.public_code, customer: row.customer, site: row.site, address: row.address, city: row.city, type: row.equipment_type, brand: row.brand ?? undefined, model: row.model ?? undefined, serialNumber: row.serial_number ?? undefined, room: row.room, difficulty: row.difficulty, internalNotes: row.internal_notes ?? undefined, jobCount: Number(row.job_count), lastService: row.last_service ?? undefined, lastTechnician: row.last_technician ?? undefined })),
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("Lecture du répertoire impossible.", error);
    return { customers: [], sites: [], equipment: [] };
  } finally {
    client.release();
  }
}
