import { AdminJobsPage } from "@/components/admin/admin-jobs-page";
import { requireUser } from "@/lib/auth/session";
import { getAdminJobsData } from "@/lib/admin-jobs-data";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const user = await requireUser(["owner", "admin", "operations"], "/admin/jobs");
  const data = await getAdminJobsData(user.organizationId);
  return <AdminJobsPage {...data} />;
}
