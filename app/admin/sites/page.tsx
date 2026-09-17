import { AdminDirectoryPage } from "@/components/admin/admin-directory-page";
import { requireUser } from "@/lib/auth/session";
import { getAdminDirectoryData } from "@/lib/admin-directory-data";

export const dynamic = "force-dynamic";

export default async function SitesPage() {
  const user = await requireUser(["owner", "admin", "operations"], "/admin/sites");
  return <AdminDirectoryPage activeView="sites" data={await getAdminDirectoryData(user.organizationId)} />;
}
