import { AdminIncidentsPage } from "@/components/admin/admin-incidents-page";
import { requireUser } from "@/lib/auth/session";
import { getAdminIncidents } from "@/lib/incident-data";

export const dynamic = "force-dynamic";

export default async function IncidentsPage() {
  const user = await requireUser(["owner", "admin", "operations"], "/admin/incidents");
  const incidents = await getAdminIncidents(user.organizationId);
  return <AdminIncidentsPage incidents={incidents} canOverride={user.role === "owner" || user.role === "admin"} />;
}
