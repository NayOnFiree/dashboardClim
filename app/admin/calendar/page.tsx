import { AdminCalendarPage } from "@/components/admin/admin-calendar-page";
import { requireUser } from "@/lib/auth/session";
import { getAdminJobsData } from "@/lib/admin-jobs-data";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const user = await requireUser(["owner", "admin", "operations"], "/admin/calendar");
  const data = await getAdminJobsData(user.organizationId);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return <AdminCalendarPage jobs={data.jobs} technicians={data.technicians} today={today} />;
}
