import { notFound } from "next/navigation";
import { AdminJobDetailPage } from "@/components/admin/admin-job-detail-page";
import { requireUser } from "@/lib/auth/session";
import { getAdminJobDetail } from "@/lib/admin-jobs-data";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({ params }: PageProps<"/admin/jobs/[id]">) {
  const { id } = await params;
  const user = await requireUser(["owner", "admin", "operations"], `/admin/jobs/${id}`);
  const job = await getAdminJobDetail(id, user.organizationId);
  if (!job) notFound();
  return <AdminJobDetailPage job={job} />;
}
