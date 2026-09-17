import { ArrowRight, LockKeyhole, ShieldCheck, Snowflake, Wrench } from "lucide-react";
import { redirect } from "next/navigation";
import { developmentSignIn } from "@/app/login/actions";
import { PasskeyLogin } from "@/components/auth/passkey-login";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "technician" || user.role === "subcontractor" ? "/app/today" : "/admin/dashboard");
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/";
  const production = process.env.NODE_ENV === "production";

  return <main className="login-page">
    <section className="login-panel">
      <div className="login-brand"><span><Snowflake size={24} /></span><div><strong>Clim Pilot</strong><small>Interventions terrain</small></div></div>
      <div className="login-copy"><span>Acces securise</span><h1>Choisir un espace de travail</h1><p>Les droits et les missions affichees dependent du profil connecte.</p></div>
      {production ? <PasskeyLogin redirectTo={next} /> : <div className="login-choices">
        <form action={developmentSignIn}><input type="hidden" name="email" value="emma@clim-air.local" /><input type="hidden" name="next" value={next} /><button><span className="login-avatar admin">EM</span><span><strong>Emma Martin</strong><small>Administration et pilotage</small></span><ShieldCheck size={20} /><ArrowRight size={18} /></button></form>
        <form action={developmentSignIn}><input type="hidden" name="email" value="nora@clim-air.local" /><input type="hidden" name="next" value={next} /><button><span className="login-avatar tech">NB</span><span><strong>Nora Bensaid</strong><small>Application technicien</small></span><Wrench size={20} /><ArrowRight size={18} /></button></form>
      </div>}
      <p className="login-footnote"><LockKeyhole size={14} />Session privée de 8 heures · {production ? "accès sur invitation uniquement" : "environnement local"}</p>
    </section>
  </main>;
}
