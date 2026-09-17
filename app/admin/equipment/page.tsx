import { AdminDirectoryPage } from "@/components/admin/admin-directory-page";
import { requireUser } from "@/lib/auth/session";
import { getAdminDirectoryData } from "@/lib/admin-directory-data";

export const dynamic = "force-dynamic";

export default async function EquipmentPage() {
  const user = await requireUser(["owner", "admin", "operations"], "/admin/equipment");
  return <AdminDirectoryPage activeView="equipment" data={await getAdminDirectoryData(user.organizationId)} />;
}
