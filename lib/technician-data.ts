import "server-only";

import { database } from "@/lib/db";
import type { Job, JobStatus, PaymentStatus } from "@/lib/mock-data";

export type Equipment = {
  id: string;
  publicCode: string;
  room: string;
  brand: string;
  model: string;
  difficulty: "Simple" | "Moyenne" | "Complexe";
  lastService: string;
  note?: string;
};

export type TechnicianJob = Job & {
  service: string;
  customerPhone: string;
  accessInstructions: string;
  currentStep: number;
  equipment: Equipment[];
};

const statusLabels: Record<string, JobStatus> = {
  scheduled: "Planifiee", assigned: "Planifiee", en_route: "En route",
  arrived: "En cours", in_progress: "En cours", blocked: "Bloquee",
  completed_pending_payment: "Terminee", completed: "Terminee",
};

const paymentLabels: Record<string, PaymentStatus> = {
  paid_cash: "Paye", paid_card: "Paye", paid_transfer: "Paye",
  not_required: "A facturer", pending: "En attente", payment_link_sent: "En attente",
  failed: "En attente", refunded: "A facturer",
};

const difficultyLabels: Record<string, Equipment["difficulty"]> = {
  simple: "Simple", medium: "Moyenne", complex: "Complexe",
};

type TechnicianJobRow = {
  public_code: string; start_time: string; end_time: string; customer_name: string;
  customer_phone: string | null; city: string; address: string; access_instructions: string | null;
  technician_name: string; status: string; payment_status: string; price_cents: number;
  service_type: string; incident: string | null; has_precheck: boolean; required_before_count: string;
  checklist_response_count: string; checklist_item_count: number;
  required_after_count: string;
  final_check_count: string;
  equipment: Array<{ id: string; public_code: string; room: string; brand: string | null; model: string | null; difficulty: string | null; note: string | null }>;
};

const serviceLabels: Record<string, string> = {
  deep_clean: "Nettoyage et hygienisation",
  maintenance: "Nettoyage standard",
};

function currentStep(status: string, hasPrecheck: boolean, requiredBeforeCount: number, checklistResponseCount: number, checklistItemCount: number, requiredAfterCount: number, finalCheckCount: number, equipmentCount: number) {
  if (["completed", "completed_pending_payment"].includes(status)) return 6;
  if (["in_progress", "blocked"].includes(status) && equipmentCount > 0 && finalCheckCount >= equipmentCount) return 5;
  if (["in_progress", "blocked"].includes(status) && requiredAfterCount >= 3) return 4;
  if (["in_progress", "blocked"].includes(status) && checklistItemCount > 0 && checklistResponseCount >= checklistItemCount) return 3;
  if (["in_progress", "blocked"].includes(status) && requiredBeforeCount >= 4) return 2;
  if (["in_progress", "blocked"].includes(status) && hasPrecheck) return 1;
  if (status === "arrived") return 1;
  return 0;
}

function completeness(status: string) {
  return { completed: 100, completed_pending_payment: 96, in_progress: 62, blocked: 48, arrived: 30, en_route: 12 }[status] ?? 0;
}

function mapJob(row: TechnicianJobRow): TechnicianJob {
  const technician = row.technician_name || "Non assigne";
  const equipment = row.equipment ?? [];
  return {
    id: row.public_code, time: row.start_time, endTime: row.end_time,
    customer: row.customer_name, city: row.city, address: row.address,
    technician,
    technicianInitials: technician.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
    equipmentCount: equipment.length,
    status: statusLabels[row.status] ?? "Planifiee",
    payment: paymentLabels[row.payment_status] ?? "En attente",
    amount: row.price_cents / 100,
    completeness: completeness(row.status),
    incident: row.incident ?? undefined,
    service: serviceLabels[row.service_type] ?? row.service_type,
    customerPhone: row.customer_phone ?? "",
    accessInstructions: row.access_instructions ?? "Aucune instruction particuliere.",
    currentStep: currentStep(row.status, row.has_precheck, Number(row.required_before_count), Number(row.checklist_response_count), row.checklist_item_count, Number(row.required_after_count), Number(row.final_check_count), equipment.length),
    equipment: equipment.map((item) => ({
      id: item.id, publicCode: item.public_code, room: item.room,
      brand: item.brand ?? "A confirmer", model: item.model ?? "Plaque a photographier",
      difficulty: difficultyLabels[item.difficulty ?? ""] ?? "Simple",
      lastService: "Premiere intervention", note: item.note ?? undefined,
    })),
  };
}

async function queryTechnicianJobs(technicianId: string, organizationId: string, publicCode?: string) {
  const client = await database.connect();
  try {
    await client.query("BEGIN READ ONLY");
    await client.query("SELECT set_config('app.organization_id', $1, true)", [organizationId]);
    const result = await client.query<TechnicianJobRow>(`
      SELECT j.public_code,
        to_char(j.scheduled_start AT TIME ZONE 'Europe/Paris', 'HH24:MI') AS start_time,
        to_char(j.scheduled_end AT TIME ZONE 'Europe/Paris', 'HH24:MI') AS end_time,
        c.name AS customer_name, c.phone AS customer_phone, s.city,
        concat_ws(', ', s.address_line1, concat(s.postal_code, ' ', s.city)) AS address,
        coalesce(s.access_notes, j.notes) AS access_instructions,
        concat_ws(' ', p.first_name, p.last_name) AS technician_name,
        j.status::text, j.payment_status::text, j.price_cents, j.service_type,
        bool_or(jp.id IS NOT NULL) AS has_precheck,
        count(DISTINCT ph.photo_type) FILTER (WHERE ph.active = true AND ph.photo_type IN ('before_overview','before_environment','model_label','before_filters'))::text AS required_before_count,
        count(DISTINCT ph.photo_type) FILTER (WHERE ph.active = true AND ph.photo_type IN ('after_overview','after_environment','after_filters'))::text AS required_after_count,
        count(DISTINCT cr.item_id)::text AS checklist_response_count,
        count(DISTINCT final.equipment_id)::text AS final_check_count,
        coalesce(max(jsonb_array_length(snapshot.snapshot_json -> 'items')), 0) AS checklist_item_count,
        max(i.description) FILTER (WHERE i.status NOT IN ('resolved', 'closed_no_action')) AS incident,
        coalesce(jsonb_agg(DISTINCT jsonb_build_object(
          'id', e.id, 'public_code', e.public_code, 'room', e.room, 'brand', e.brand,
          'model', e.model, 'difficulty', e.difficulty, 'note', e.internal_notes
        )) FILTER (WHERE e.id IS NOT NULL), '[]'::jsonb) AS equipment
      FROM jobs j
      JOIN sites s ON s.id = j.site_id
      JOIN customers c ON c.id = s.customer_id
      JOIN profiles p ON p.id = j.primary_technician_id
      LEFT JOIN job_equipment je ON je.job_id = j.id
      LEFT JOIN equipment e ON e.id = je.equipment_id
      LEFT JOIN incidents i ON i.job_id = j.id
      LEFT JOIN job_prechecks jp ON jp.job_id = j.id
      LEFT JOIN photos ph ON ph.job_id = j.id AND ph.equipment_id = e.id
      LEFT JOIN checklist_responses cr ON cr.job_id = j.id AND cr.equipment_id = e.id
      LEFT JOIN job_checklist_snapshots snapshot ON snapshot.job_id = j.id
      LEFT JOIN job_final_checks final ON final.job_id = j.id
      WHERE p.id = $1
        AND j.organization_id = $2
        AND ($3::text IS NULL OR j.public_code = $3)
        AND ($3::text IS NOT NULL OR (j.scheduled_start AT TIME ZONE 'Europe/Paris')::date = (now() AT TIME ZONE 'Europe/Paris')::date)
      GROUP BY j.id, c.id, s.id, p.id
      ORDER BY j.scheduled_start
    `, [technicianId, organizationId, publicCode ?? null]);
    await client.query("ROLLBACK");
    return result.rows.map(mapJob);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("Lecture des missions technicien impossible.", error);
    return [];
  } finally {
    client.release();
  }
}

export async function getTechnicianJobs(technicianId: string, organizationId: string) {
  return queryTechnicianJobs(technicianId, organizationId);
}

export async function getTechnicianJob(id: string, technicianId: string, organizationId: string) {
  const jobs = await queryTechnicianJobs(technicianId, organizationId, id);
  return jobs[0];
}
