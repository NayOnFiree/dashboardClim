import { notFound } from "next/navigation";
import { BeforePhotos } from "@/components/technician/before-photos";
import { requireUser } from "@/lib/auth/session";
import { getBeforePhotos } from "@/lib/photo-data";
import { getTechnicianJob } from "@/lib/technician-data";

export const dynamic = "force-dynamic";

export default async function BeforePhotosPage({ params }: { params: Promise<{ id: string; equipmentId: string }> }) {
  const { id, equipmentId } = await params;
  const user = await requireUser(["technician", "subcontractor"], `/app/jobs/${id}/equipment/${equipmentId}/before`);
  const job = await getTechnicianJob(id, user.id, user.organizationId);
  if (!job) notFound();
  const equipment = job.equipment.find((item) => item.id === equipmentId);
  if (!equipment) notFound();
  const photos = await getBeforePhotos(id, equipmentId, user.id, user.organizationId);
  return <BeforePhotos job={job} equipment={equipment} initialPhotos={photos} />;
}
