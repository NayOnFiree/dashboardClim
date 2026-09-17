import { notFound } from "next/navigation";
import { FinalCheckForm } from "@/components/technician/final-check-form";
import { requireUser } from "@/lib/auth/session";
import { getFinalChecks } from "@/lib/final-check-data";
import { getTechnicianJob } from "@/lib/technician-data";

export const dynamic = "force-dynamic";

export default async function FinalCheckPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(["technician", "subcontractor"], `/app/jobs/${id}/final-check`);
  const job = await getTechnicianJob(id, user.id, user.organizationId);
  if (!job) notFound();
  const initialChecks = await getFinalChecks(id, user.id, user.organizationId);
  return <FinalCheckForm job={job} initialChecks={initialChecks} />;
}
