import { TodayScreen } from "@/components/technician/today-screen";
import { requireUser } from "@/lib/auth/session";
import { getTechnicianJobs } from "@/lib/technician-data";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const user = await requireUser(["technician", "subcontractor"], "/app/today");
  const jobs = await getTechnicianJobs(user.id, user.organizationId);
  return <TodayScreen jobs={jobs} firstName={user.firstName} />;
}
