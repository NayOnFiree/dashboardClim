import { requireUser } from "@/lib/auth/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireUser(["owner", "admin", "operations"], "/admin/dashboard");
  return children;
}
