import { notFound } from "next/navigation";
import { JobDetail } from "@/components/technician/job-detail";
import { requireUser } from "@/lib/auth/session";
import { getTechnicianJob } from "@/lib/technician-data";

export const dynamic = "force-dynamic";

export default async function JobPage({ params }: PageProps<"/app/jobs/[id]">) {
  const { id } = await params;
  const user = await requireUser(["technician", "subcontractor"], `/app/jobs/${id}`);
  const job = await getTechnicianJob(id, user.id, user.organizationId);
  if (!job) notFound();
  return <JobDetail job={job} />;
}
