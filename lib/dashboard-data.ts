import "server-only";

import { database } from "@/lib/db";
import { jobs as demoJobs, type Job, type JobStatus, type PaymentStatus } from "@/lib/mock-data";

export type DashboardDataSource = "database" | "demo";

export type DashboardData = {
  jobs: Job[];
  source: DashboardDataSource;
};

const statusLabels: Record<string, JobStatus> = {
  scheduled: "Planifiee",
  assigned: "Planifiee",
  en_route: "En route",
  arrived: "En cours",
  in_progress: "En cours",
  blocked: "Bloquee",
  completed_pending_payment: "Terminee",
  completed: "Terminee",
};

const paymentLabels: Record<string, PaymentStatus> = {
  paid_cash: "Paye",
  paid_card: "Paye",
  paid_transfer: "Paye",
  not_required: "A facturer",
  pending: "En attente",
  payment_link_sent: "En attente",
  failed: "En attente",
  refunded: "A facturer",
};

type JobRow = {
  public_code: string;
  start_time: string;
  end_time: string;
  customer_name: string;
  city: string;
  address: string;
  technician_name: string;
  equipment_count: string;
  status: string;
  payment_status: string;
  price_cents: number;
  notes: string | null;
  incident: string | null;
};

function completenessFor(status: string) {
  return {
    completed: 100,
    completed_pending_payment: 96,
    in_progress: 62,
    arrived: 35,
    blocked: 48,
    en_route: 12,
  }[status] ?? 0;
}

export async function getDashboardData(organizationId: string): Promise<DashboardData> {
  const client = await database.connect();

  try {
    await client.query("BEGIN READ ONLY");
    await client.query("SELECT set_config('app.organization_id', $1, true)", [organizationId]);
    const result = await client.query<JobRow>(`
      SELECT
        j.public_code,
        to_char(j.scheduled_start AT TIME ZONE 'Europe/Paris', 'HH24:MI') AS start_time,
        to_char(j.scheduled_end AT TIME ZONE 'Europe/Paris', 'HH24:MI') AS end_time,
        c.name AS customer_name,
        s.city,
        concat_ws(', ', s.address_line1, concat(s.postal_code, ' ', s.city)) AS address,
        concat_ws(' ', p.first_name, p.last_name) AS technician_name,
        count(je.equipment_id)::text AS equipment_count,
        j.status::text,
        j.payment_status::text,
        j.price_cents,
        coalesce(j.notes, s.access_notes) AS notes,
        max(i.description) FILTER (WHERE i.status NOT IN ('resolved', 'closed_no_action')) AS incident
      FROM jobs j
      JOIN sites s ON s.id = j.site_id
      JOIN customers c ON c.id = s.customer_id
      LEFT JOIN profiles p ON p.id = j.primary_technician_id
      LEFT JOIN job_equipment je ON je.job_id = j.id
      LEFT JOIN incidents i ON i.job_id = j.id
      WHERE j.organization_id = $1
        AND j.scheduled_start >= timestamptz '2026-09-17 00:00:00+02'
        AND j.scheduled_start < timestamptz '2026-09-18 00:00:00+02'
      GROUP BY j.id, c.name, s.id, p.id
      ORDER BY j.scheduled_start
    `, [organizationId]);
    await client.query("ROLLBACK");

    if (!result.rowCount) return { jobs: demoJobs, source: "demo" };

    return {
      source: "database",
      jobs: result.rows.map((row) => {
        const technician = row.technician_name || "Non assigne";
        return {
          id: row.public_code,
          time: row.start_time,
          endTime: row.end_time,
          customer: row.customer_name,
          city: row.city,
          address: row.address,
          technician,
          technicianInitials: technician.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
          equipmentCount: Number(row.equipment_count),
          status: statusLabels[row.status] ?? "Planifiee",
          payment: paymentLabels[row.payment_status] ?? "En attente",
          amount: row.price_cents / 100,
          completeness: completenessFor(row.status),
          note: row.notes ?? undefined,
          incident: row.incident ?? undefined,
        };
      }),
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("Lecture PostgreSQL impossible pour le dashboard.", error);
    return { jobs: demoJobs, source: "demo" };
  } finally {
    client.release();
  }
}
