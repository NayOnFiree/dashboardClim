import { Fingerprint, LockKeyhole, Snowflake } from "lucide-react";
import { notFound } from "next/navigation";
import { PasskeyActivation } from "@/components/auth/passkey-activation";
import { getInvitationInfo } from "@/lib/auth/invitations";

export const dynamic = "force-dynamic";
export default async function ActivatePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params; const invitation = await getInvitationInfo(token);
  if (!invitation) notFound();
  return <main className="login-page"><section className="login-panel activation-panel"><div className="login-brand"><span><Snowflake size={24} /></span><div><strong>Clim Pilot</strong><small>Activation sécurisée</small></div></div><div className="login-copy"><span>Invitation personnelle</span><h1>Bonjour {invitation.name}</h1><p>Enregistrez une passkey pour accéder à votre espace {invitation.role === "owner" || invitation.role === "admin" ? "administrateur" : "technicien"}.</p></div>{invitation.available ? <PasskeyActivation token={token} email={invitation.email} /> : <div className="login-unavailable"><LockKeyhole /><div><strong>Invitation indisponible</strong><p>Ce lien a expiré ou a déjà été utilisé. Demandez une nouvelle invitation à votre administrateur.</p></div></div>}<div className="activation-expiry"><Fingerprint /><span>Invitation valable jusqu’au {invitation.expiresAt}</span></div></section></main>;
}
