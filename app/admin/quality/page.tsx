import { AdminQualityPage } from "@/components/admin/admin-resources-pages";
import { requireUser } from "@/lib/auth/session";
import { getQualityJobs } from "@/lib/admin-resources-data";

export const dynamic = "force-dynamic";
export default async function QualityPage() {
  const user = await requireUser(["owner", "admin", "operations"], "/admin/quality");
  return <AdminQualityPage jobs={await getQualityJobs(user.organizationId)} />;
}
