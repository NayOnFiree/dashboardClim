import { notFound } from "next/navigation";
import { TechnicianProfilePage } from "@/components/technician/account-pages";
import { requireUser } from "@/lib/auth/session";
import { getTechnicianProfile } from "@/lib/technician-account-data";

export const dynamic = "force-dynamic";
export default async function ProfilePage() {
  const user = await requireUser(["technician", "subcontractor"], "/app/profile");
  const profile = await getTechnicianProfile(user.id, user.organizationId);
  if (!profile) notFound();
  return <TechnicianProfilePage profile={profile} />;
}
