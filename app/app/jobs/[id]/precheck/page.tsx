import { notFound } from "next/navigation";
import { PrecheckForm } from "@/components/technician/precheck-form";
import { requireUser } from "@/lib/auth/session";
import { getTechnicianJob } from "@/lib/technician-data";

export const dynamic = "force-dynamic";

export default async function PrecheckPage({ params }: PageProps<"/app/jobs/[id]/precheck">) {
  const { id } = await params;
  const user = await requireUser(["technician", "subcontractor"], `/app/jobs/${id}/precheck`);
  const job = await getTechnicianJob(id, user.id, user.organizationId);
  if (!job) notFound();
  return <PrecheckForm job={job} />;
}
