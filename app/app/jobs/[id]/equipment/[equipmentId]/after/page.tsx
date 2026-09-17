import { notFound } from "next/navigation";
import { AfterPhotos } from "@/components/technician/after-photos";
import { requireUser } from "@/lib/auth/session";
import { getAfterPhotos } from "@/lib/photo-data";
import { getTechnicianJob } from "@/lib/technician-data";

export const dynamic = "force-dynamic";

export default async function AfterPhotosPage({ params }: { params: Promise<{ id: string; equipmentId: string }> }) {
  const { id, equipmentId } = await params;
  const user = await requireUser(["technician", "subcontractor"], `/app/jobs/${id}/equipment/${equipmentId}/after`);
  const job = await getTechnicianJob(id, user.id, user.organizationId);
  if (!job) notFound();
  const equipment = job.equipment.find((item) => item.id === equipmentId);
  if (!equipment) notFound();
  const photos = await getAfterPhotos(id, equipmentId, user.id, user.organizationId);
  return <AfterPhotos job={job} equipment={equipment} initialPhotos={photos} />;
}
