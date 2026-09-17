"use client";

import { AlertTriangle, Fingerprint, LoaderCircle } from "lucide-react";
import { FormEvent, useState } from "react";
import { signIn } from "next-auth/webauthn";

export function PasskeyLogin({ redirectTo }: { redirectTo: string }) {
  const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setLoading(true); setError("");
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim().toLowerCase();
    try {
      const result = await signIn("passkey", { email, action: "authenticate", redirect: false, redirectTo });
      if (!result?.ok || result.error) throw new Error("Connexion impossible. Vérifiez l’adresse ou contactez un administrateur.");
      window.location.assign(result.url ?? redirectTo);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Connexion impossible."); setLoading(false); }
  };
  return <form className="passkey-login" onSubmit={submit}><label>E-mail professionnel<input name="email" type="email" autoComplete="username webauthn" required placeholder="prenom@entreprise.fr" /></label><button disabled={loading}>{loading ? <LoaderCircle className="spin" /> : <Fingerprint />}<span><strong>{loading ? "Vérification…" : "Continuer avec ma passkey"}</strong><small>Empreinte, visage, code appareil ou clé de sécurité</small></span></button>{error && <div className="passkey-error"><AlertTriangle />{error}</div>}<p>Pas encore de passkey ? Utilisez uniquement le lien d’invitation envoyé par votre administrateur.</p></form>;
}
