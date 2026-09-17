import { notFound } from "next/navigation";
import { IncidentForm } from "@/components/technician/incident-form";
import { requireUser } from "@/lib/auth/session";
import { getJobIncidents } from "@/lib/incident-data";
import { getTechnicianJob } from "@/lib/technician-data";

export const dynamic = "force-dynamic";

export default async function JobIncidentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(["technician", "subcontractor"], `/app/jobs/${id}/incidents`);
  const job = await getTechnicianJob(id, user.id, user.organizationId);
  if (!job) notFound();
  const incidents = await getJobIncidents(id, user.id, user.organizationId);
  return <IncidentForm job={job} initialIncidents={incidents} />;
}
