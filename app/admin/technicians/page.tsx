import { AdminTechniciansPage } from "@/components/admin/admin-resources-pages";
import { requireUser } from "@/lib/auth/session";
import { getAdminTechnicians } from "@/lib/admin-resources-data";

export const dynamic = "force-dynamic";
export default async function TechniciansPage() {
  const user = await requireUser(["owner", "admin", "operations"], "/admin/technicians");
  return <AdminTechniciansPage technicians={await getAdminTechnicians(user.organizationId)} />;
}
