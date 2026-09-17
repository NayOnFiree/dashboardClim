import { TechnicianSyncPage } from "@/components/technician/account-pages";
import { requireUser } from "@/lib/auth/session";
import { getTechnicianSyncData } from "@/lib/technician-account-data";

export const dynamic = "force-dynamic";
export default async function SyncPage() {
  const user = await requireUser(["technician", "subcontractor"], "/app/sync");
  return <TechnicianSyncPage data={await getTechnicianSyncData(user.id, user.organizationId)} />;
}
