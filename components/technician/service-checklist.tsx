"use client";

import { AlertTriangle, ArrowLeft, ArrowRight, Beaker, Check, CheckCircle2, Clock3, LoaderCircle, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { ChecklistValue, ServiceChecklist } from "@/lib/checklist-data";
import type { Equipment, TechnicianJob } from "@/lib/technician-data";

type AnswerState = { value: ChecklistValue; reason: string };

export function ServiceChecklistForm({ job, equipment, checklist }: { job: TechnicianJob; equipment: Equipment; checklist: ServiceChecklist }) {
  const [answers, setAnswers] = useState<Record<string, AnswerState>>(() => Object.fromEntries(checklist.items.map((item) => [item.id, { value: item.value ?? {}, reason: item.reason ?? "" }])));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const isComplete = (item: ServiceChecklist["items"][number]) => {
    const answer = answers[item.id];
    if (!answer) return false;
    if (item.responseType === "product") return Boolean(answer.value.productId) && Number(answer.value.quantityMl) > 0;
    if (!answer.value.answer || !item.options.includes(answer.value.answer)) return false;
    return !item.requiredOrReason || answer.value.answer === "Fait" || answer.reason.trim().length >= 3;
  };
  const completed = checklist.items.filter(isComplete).length;
  const selectedProduct = (itemId: string) => checklist.products.find((product) => product.id === answers[itemId]?.value.productId);

  const choose = (itemId: string, answer: string) => {
    setError("");
    setAnswers((current) => ({ ...current, [itemId]: { ...current[itemId], value: { answer } } }));
  };

  const submit = async () => {
    const incomplete = checklist.items.find((item) => item.required && !isComplete(item));
    if (incomplete) {
      setError(`Complétez « ${incomplete.label} » avant de continuer.`);
      document.getElementById(`checklist-${incomplete.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/jobs/${job.id}/equipment/${equipment.id}/checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses: checklist.items.map((item) => ({ itemId: item.id, value: answers[item.id].value, reason: answers[item.id].reason.trim() || undefined })) }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Enregistrement impossible.");
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Enregistrement impossible.");
    } finally { setSaving(false); }
  };

  if (saved) return <div className="precheck-screen precheck-success"><span><CheckCircle2 size={34} /></span><p>Étape 3 terminée</p><h1>Nettoyage enregistré</h1><p>Les opérations, le produit et la quantité utilisés sont conservés avec la version {checklist.templateVersion} de la checklist.</p><Link className="primary-tech-action" href={`/app/jobs/${job.id}`}>Retour à la mission<ArrowRight size={19} /></Link></div>;

  return <div className="service-screen">
    <header className="precheck-header"><Link className="round-back" href={`/app/jobs/${job.id}`} aria-label="Retour"><ArrowLeft size={20} /></Link><div><span>Étape 3 sur 6</span><h1>Nettoyage</h1><p>{equipment.room} · {equipment.brand} {equipment.model}</p></div></header>
    <div className="service-meta"><span>{checklist.templateName}</span><small>Version {checklist.templateVersion} figée pour cette intervention</small></div>
    <div className="photo-progress"><div><i style={{ width: `${(completed / checklist.items.length) * 100}%` }} /></div><strong>{completed}/{checklist.items.length}</strong><span>opérations renseignées</span></div>
    <div className="safety-reminder"><ShieldCheck size={19} /><div><strong>Protégez la zone avant tout nettoyage humide</strong><p>La bâche et la protection électronique sont bloquantes. Une opération partielle ou inaccessible doit être justifiée.</p></div></div>

    <section className="service-list">{checklist.items.map((item) => {
      const state = answers[item.id]; const product = selectedProduct(item.id); const complete = isComplete(item);
      return <article id={`checklist-${item.id}`} className={`service-item ${complete ? "complete" : ""} ${item.criticalRequired ? "critical" : ""}`} key={item.id}>
        <div className="service-item-heading"><span>{complete ? <Check size={15} /> : item.orderIndex}</span><div><h2>{item.label}</h2><small>{item.criticalRequired ? "Obligatoire · Bloquant" : item.requiredOrReason ? "Obligatoire ou justification" : "Obligatoire"}</small></div></div>
        {item.responseType === "choice" ? <div className="answer-options">{item.options.map((option) => <button type="button" className={state.value.answer === option ? "selected" : ""} onClick={() => choose(item.id, option)} key={option}>{state.value.answer === option && <Check size={15} />}{option}</button>)}</div> : <div className="product-fields">
          <label>Produit utilisé<select value={state.value.productId ?? ""} onChange={(event) => setAnswers((current) => ({ ...current, [item.id]: { ...current[item.id], value: { ...current[item.id].value, productId: event.target.value } } }))}><option value="">Sélectionner un produit</option>{checklist.products.map((entry) => <option value={entry.id} key={entry.id}>{entry.name}{entry.manufacturer ? ` · ${entry.manufacturer}` : ""}</option>)}</select></label>
          <label>Quantité utilisée (ml)<input type="number" min="1" max="5000" inputMode="numeric" value={state.value.quantityMl ?? ""} onChange={(event) => setAnswers((current) => ({ ...current, [item.id]: { ...current[item.id], value: { ...current[item.id].value, quantityMl: Number(event.target.value) || undefined } } }))} placeholder="Ex. 150" /></label>
          {product && <div className="product-card"><div><Beaker size={17} /><strong>{product.name}</strong></div><p>{product.instructions}</p><ul><li><Clock3 size={14} />Temps de contact : {product.contactTimeMinutes ?? 0} min</li><li><CheckCircle2 size={14} />{product.rinseRule}</li></ul>{product.safetyNotes && <small><AlertTriangle size={14} />{product.safetyNotes}</small>}</div>}
        </div>}
        {item.requiredOrReason && state.value.answer && state.value.answer !== "Fait" && <label className="service-reason">Justification obligatoire<textarea value={state.reason} onChange={(event) => setAnswers((current) => ({ ...current, [item.id]: { ...current[item.id], reason: event.target.value } }))} placeholder="Expliquez la zone inaccessible ou le traitement partiel…" /></label>}
      </article>;
    })}</section>

    {error && <div className="service-error"><AlertTriangle size={17} />{error}</div>}
    <div className="precheck-action"><div><strong>{completed === checklist.items.length ? "Checklist complète" : `${checklist.items.length - completed} opération${checklist.items.length - completed > 1 ? "s" : ""} à renseigner`}</strong><span>Chaque réponse sera horodatée et rattachée à cet équipement.</span></div><button className="primary-tech-action" type="button" disabled={saving || completed !== checklist.items.length} onClick={submit}>{saving ? <><LoaderCircle className="spin" size={19} />Enregistrement…</> : <>Valider le nettoyage<ArrowRight size={19} /></>}</button></div>
  </div>;
}
