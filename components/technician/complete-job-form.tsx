"use client";

import { ArrowLeft, ArrowRight, Banknote, Check, CheckCircle2, CreditCard, FileClock, LoaderCircle, MessageCircle, ReceiptText, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { TechnicianJob } from "@/lib/technician-data";

const paymentOptions = [
  { value: "paid_card", label: "Carte", icon: CreditCard },
  { value: "paid_cash", label: "Espèces", icon: Banknote },
  { value: "paid_transfer", label: "Virement", icon: ReceiptText },
  { value: "pending", label: "En attente", icon: FileClock },
  { value: "not_required", label: "À facturer", icon: ReceiptText },
] as const;

export function CompleteJobForm({ job }: { job: TechnicianJob }) {
  const [paymentStatus, setPaymentStatus] = useState(""); const [clientInformed, setClientInformed] = useState(false); const [reviewAllowed, setReviewAllowed] = useState(false);
  const [saving, setSaving] = useState(false); const [saved, setSaved] = useState(false); const [error, setError] = useState("");
  const submit = async () => {
    if (!paymentStatus || !clientInformed) { setError("Renseignez le paiement et confirmez que le client a été informé."); return; }
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/jobs/${job.id}/complete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paymentStatus, clientInformed, reviewAllowed }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Clôture impossible.");
      setSaved(true);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Clôture impossible."); }
    finally { setSaving(false); }
  };

  if (saved) return <div className="precheck-screen precheck-success"><span><CheckCircle2 size={34} /></span><p>Intervention clôturée</p><h1>Mission terminée</h1><p>Le rapport est complet et l’événement de fin est prêt pour les automatisations CRM, notification client et demande d’avis.</p><Link className="primary-tech-action" href="/app/today">Retour à ma tournée<ArrowRight size={19} /></Link></div>;

  return <div className="complete-screen">
    <header className="precheck-header"><Link className="round-back" href={`/app/jobs/${job.id}`} aria-label="Retour"><ArrowLeft size={20} /></Link><div><span>Étape 6 sur 6</span><h1>Terminer l’intervention</h1><p>{job.customer} · {job.id}</p></div></header>
    <section className="completion-summary"><div><span>Équipements traités</span><strong>{job.equipmentCount}</strong></div><div><span>Service</span><strong>{job.service}</strong></div><div><span>Montant</span><strong>{job.amount.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</strong></div></section>
    <div className="completion-ready"><ShieldCheck size={20} /><div><strong>Parcours terrain complet</strong><p>Le serveur vérifiera à nouveau les pré-contrôles, photos, checklists, tests finaux et incidents critiques.</p></div></div>
    <section className="completion-card"><span>Paiement</span><h2>Comment l’intervention est-elle réglée ?</h2><div className="payment-options">{paymentOptions.map((option) => { const Icon = option.icon; return <button type="button" className={paymentStatus === option.value ? "selected" : ""} onClick={() => setPaymentStatus(option.value)} key={option.value}><Icon size={19} /><strong>{option.label}</strong>{paymentStatus === option.value && <Check size={16} />}</button>; })}</div></section>
    <section className="completion-card completion-confirmations"><label className={clientInformed ? "checked" : ""}><input type="checkbox" checked={clientInformed} onChange={(event) => setClientInformed(event.target.checked)} /><span><Check size={15} /></span><div><strong>Client informé du résultat</strong><small>Les opérations et les éventuels incidents lui ont été expliqués.</small></div></label><label className={reviewAllowed ? "checked" : ""}><input type="checkbox" checked={reviewAllowed} onChange={(event) => setReviewAllowed(event.target.checked)} /><span><Check size={15} /></span><div><strong>Demande d’avis autorisée</strong><small>Une automatisation pourra envoyer la demande sur le canal disponible.</small></div><MessageCircle size={18} /></label></section>
    {error && <div className="service-error">{error}</div>}
    <div className="precheck-action"><div><strong>Dernière validation</strong><span>La clôture est horodatée et ne pourra être rouverte que par un administrateur.</span></div><button className="primary-tech-action" type="button" disabled={saving || !paymentStatus || !clientInformed} onClick={submit}>{saving ? <><LoaderCircle className="spin" size={19} />Clôture…</> : <>Terminer l’intervention<CheckCircle2 size={19} /></>}</button></div>
  </div>;
}
