"use client";

import { AlertTriangle, Fingerprint, LoaderCircle, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { signIn } from "next-auth/webauthn";
import { activateInvitation } from "@/app/activate/actions";

export function PasskeyActivation({ token, email }: { token: string; email: string }) {
  const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  const register = async () => {
    setLoading(true); setError("");
    try {
      const activation = await activateInvitation(token);
      if (!activation.ok) throw new Error(activation.error);
      const result = await signIn("passkey", { email: activation.email, action: "register", redirect: false, redirectTo: "/" });
      if (!result?.ok || result.error) throw new Error("La passkey n’a pas pu être enregistrée.");
      window.location.assign(result.url ?? "/");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Activation impossible."); setLoading(false); }
  };
  return <><button className="passkey-primary" onClick={register} disabled={loading}>{loading ? <LoaderCircle className="spin" /> : <Fingerprint />}<span><strong>{loading ? "Activation…" : "Créer ma passkey"}</strong><small>{email}</small></span></button><div className="passkey-security"><ShieldCheck /><p>La passkey restera protégée par le verrouillage de votre appareil. Aucun mot de passe n’est créé ni transmis.</p></div>{error && <div className="passkey-error"><AlertTriangle />{error}</div>}</>;
}
