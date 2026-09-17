import { TechShell } from "@/components/technician/tech-shell";
import { requireUser } from "@/lib/auth/session";
import "./technician.css";

export default async function TechnicianLayout({ children }: { children: React.ReactNode }) {
  await requireUser(["technician", "subcontractor"], "/app/today");
  return <TechShell>{children}</TechShell>;
}
