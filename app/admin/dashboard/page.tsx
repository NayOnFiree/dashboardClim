import { Dashboard } from "@/components/dashboard";
import { requireUser } from "@/lib/auth/session";
import { getDashboardData } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const user = await requireUser(["owner", "admin", "operations"], "/admin/dashboard");
  const data = await getDashboardData(user.organizationId);
  return <Dashboard initialJobs={data.jobs} dataSource={data.source} />;
}
