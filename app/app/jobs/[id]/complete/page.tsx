import { notFound } from "next/navigation";
import { CompleteJobForm } from "@/components/technician/complete-job-form";
import { requireUser } from "@/lib/auth/session";
import { getTechnicianJob } from "@/lib/technician-data";

export const dynamic = "force-dynamic";

export default async function CompleteJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(["technician", "subcontractor"], `/app/jobs/${id}/complete`);
  const job = await getTechnicianJob(id, user.id, user.organizationId);
  if (!job) notFound();
  return <CompleteJobForm job={job} />;
}
