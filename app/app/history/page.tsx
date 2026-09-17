import { TechnicianHistoryPage } from "@/components/technician/account-pages";
import { requireUser } from "@/lib/auth/session";
import { getTechnicianHistory } from "@/lib/technician-account-data";

export const dynamic = "force-dynamic";
export default async function HistoryPage() {
  const user = await requireUser(["technician", "subcontractor"], "/app/history");
  return <TechnicianHistoryPage jobs={await getTechnicianHistory(user.id, user.organizationId)} />;
}
