"use server";

import { redirect } from "next/navigation";
import { createSession, deleteSession, type AppRole, type CurrentUser } from "@/lib/auth/session";
import { database } from "@/lib/db";
import { authSignOut } from "@/auth";

function safeDestination(value: FormDataEntryValue | null) {
  const destination = typeof value === "string" ? value : "/";
  return destination.startsWith("/") && !destination.startsWith("//") ? destination : "/";
}

export async function developmentSignIn(formData: FormData) {
  if (process.env.NODE_ENV === "production") redirect("/login?error=unavailable");

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const destination = safeDestination(formData.get("next"));
  const allowedEmails = new Set(["emma@clim-air.local", "nora@clim-air.local"]);
  if (!allowedEmails.has(email)) redirect("/login?error=invalid");

  const result = await database.query<{
    id: string; organization_id: string; email: string; role: AppRole; first_name: string; last_name: string;
  }>(`
    SELECT id, organization_id, email, role::text, first_name, last_name
    FROM profiles
    WHERE lower(email) = $1 AND active = true
    LIMIT 1
  `, [email]);
  const profile = result.rows[0];
  if (!profile) redirect("/login?error=invalid");

  const user: CurrentUser = {
    id: profile.id, organizationId: profile.organization_id, email: profile.email,
    role: profile.role, firstName: profile.first_name, lastName: profile.last_name,
  };
  await createSession(user);
  const roleDestination = user.role === "technician" || user.role === "subcontractor" ? "/app/today" : "/admin/dashboard";
  redirect(destination === "/" ? roleDestination : destination);
}

export async function signOut() {
  if (process.env.NODE_ENV === "production") {
    await authSignOut({ redirectTo: "/login" });
    return;
  }
  await deleteSession();
  redirect("/login");
}
