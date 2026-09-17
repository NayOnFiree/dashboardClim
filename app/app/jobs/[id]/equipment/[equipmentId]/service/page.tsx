import { notFound } from "next/navigation";
import { ServiceChecklistForm } from "@/components/technician/service-checklist";
import { requireUser } from "@/lib/auth/session";
import { getServiceChecklist } from "@/lib/checklist-data";
import { getTechnicianJob } from "@/lib/technician-data";

export const dynamic = "force-dynamic";

export default async function ServicePage({ params }: { params: Promise<{ id: string; equipmentId: string }> }) {
  const { id, equipmentId } = await params;
  const user = await requireUser(["technician", "subcontractor"], `/app/jobs/${id}/equipment/${equipmentId}/service`);
  const job = await getTechnicianJob(id, user.id, user.organizationId);
  if (!job) notFound();
  const equipment = job.equipment.find((item) => item.id === equipmentId);
  if (!equipment) notFound();
  const checklist = await getServiceChecklist(id, equipmentId, user.id, user.organizationId);
  if (!checklist) notFound();
  return <ServiceChecklistForm job={job} equipment={equipment} checklist={checklist} />;
}
