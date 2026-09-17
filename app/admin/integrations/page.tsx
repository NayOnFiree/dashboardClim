import { AdminIntegrationsPage } from "@/components/admin/admin-integrations-page";
import { requireUser } from "@/lib/auth/session";
import { getIntegrationOverview } from "@/lib/integration-data";

export const dynamic = "force-dynamic";
export default async function IntegrationsPage() {
  const user = await requireUser(["owner", "admin"], "/admin/integrations");
  return <AdminIntegrationsPage overview={await getIntegrationOverview(user.organizationId)} />;
}
