import { AdminAccessPage } from "@/components/admin/admin-access-page";
import { requireUser } from "@/lib/auth/session";
import { getAccessUsers } from "@/lib/access-data";

export const dynamic = "force-dynamic";
export default async function AccessPage() {
  const user = await requireUser(["owner", "admin"], "/admin/access");
  return <AdminAccessPage users={await getAccessUsers(user.organizationId)} currentRole={user.role} />;
}
